import { useCallback, useEffect, useMemo, useState } from 'react';
import Home from './pages/Home';
import Auth from './pages/Auth';
import EventWizard from './pages/EventWizard/EventWizard';
import {
  AUTH_TOKEN_STORAGE_KEY,
  setAuthToken as setApiAuthToken,
  fetchNotifications,
  triggerDraw as triggerEventDraw,
} from './services/api';

const THEME_STORAGE_KEY = 'ssfl-theme-preference';

const getInitialDrawState = () => ({
  loading: false,
  error: '',
  result: null,
});

const getInitialNotificationsState = () => ({
  loading: false,
  error: '',
  list: null,
  loaded: false,
});

const getInitialShareState = () => ({
  loading: false,
  status: '',
  error: '',
});

const getInitialAuthToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

const getInitialThemePreference = () => {
  if (typeof window === 'undefined') {
    return 'system';
  }
  return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
};

const getSystemPrefersDark = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

function App() {
  const [view, setView] = useState('home');
  const [creator, setCreator] = useState(null);
  const [eventSummary, setEventSummary] = useState(null);
  const [themePreference, setThemePreference] = useState(getInitialThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const [authToken, setAuthToken] = useState(getInitialAuthToken);
  const [drawState, setDrawState] = useState(getInitialDrawState);
  const [notificationsState, setNotificationsState] = useState(
    getInitialNotificationsState
  );
  const [shareState, setShareState] = useState(getInitialShareState);

  const navigation = useMemo(
    () => ({
      goHome: () => {
        setView('home');
        setEventSummary(null);
        setDrawState(getInitialDrawState());
        setNotificationsState(getInitialNotificationsState());
        setShareState(getInitialShareState());
      },
      goAuth: () => setView('auth'),
      goWizard: () => setView('wizard'),
      goConfirmation: () => setView('confirmation'),
    }),
    []
  );

  const handleAuthSuccess = (token, account) => {
    setAuthToken(token || null);
    setCreator(account || null);
    navigation.goWizard();
  };

  const handleEventComplete = (summary) => {
    setEventSummary(summary);
    setDrawState(getInitialDrawState());
    setNotificationsState(getInitialNotificationsState());
    setShareState(getInitialShareState());
    navigation.goConfirmation();
  };

  const handleSignOut = () => {
    setApiAuthToken(null);
    setCreator(null);
    setEventSummary(null);
    setAuthToken(null);
    setDrawState(getInitialDrawState());
    setNotificationsState(getInitialNotificationsState());
    setShareState(getInitialShareState());
    navigation.goHome();
  };

  const loadNotifications = useCallback(async () => {
    if (!eventSummary?.id) {
      setNotificationsState({
        loading: false,
        error: "Identifiant de l’évènement introuvable.",
        list: null,
        loaded: true,
      });
      return;
    }
    if (!authToken) {
      setNotificationsState({
        loading: false,
        error: 'Authentification requise pour consulter les envois.',
        list: null,
        loaded: true,
      });
      return;
    }
    setNotificationsState((previous) => ({
      ...previous,
      loading: true,
      error: '',
      loaded: true,
    }));
    try {
      const response = await fetchNotifications(eventSummary.id, authToken);
      setNotificationsState({
        loading: false,
        error: '',
        list: response?.notifications || [],
        loaded: true,
      });
    } catch (error) {
      setNotificationsState({
        loading: false,
        error: error?.message || 'Impossible de récupérer les envois.',
        list: null,
        loaded: true,
      });
    }
  }, [authToken, eventSummary?.id]);

  const handleTriggerDraw = useCallback(async () => {
    if (!eventSummary?.id) {
      setDrawState({
        loading: false,
        error: "Impossible de lancer le tirage sans identifiant d’évènement.",
        result: null,
      });
      return;
    }
    if (!authToken) {
      setDrawState({
        loading: false,
        error: 'Veuillez vous reconnecter pour lancer le tirage.',
        result: null,
      });
      return;
    }
    setDrawState({ loading: true, error: '', result: null });
    try {
      const response = await triggerEventDraw(eventSummary.id, authToken);
      setDrawState({ loading: false, error: '', result: response });
      await loadNotifications();
    } catch (error) {
      setDrawState({
        loading: false,
        error: error?.message || 'Le tirage a échoué.',
        result: null,
      });
    }
  }, [authToken, eventSummary?.id, loadNotifications]);

  const handleViewNotifications = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleShareEvent = useCallback(async () => {
    if (!eventSummary) {
      setShareState({
        loading: false,
        status: '',
        error: "Impossible de partager un évènement introuvable.",
      });
      return;
    }
    setShareState({ loading: true, status: '', error: '' });
    try {
      const title = eventSummary.name || eventSummary.title || 'Secret Santa';
      const organizer = eventSummary.creatorEmail || creator?.email || '';
      const shareUrl =
        typeof window !== 'undefined' && eventSummary.id
          ? `${window.location.origin}/events/${eventSummary.id}`
          : '';
      const shareTextParts = [`Participez à mon Secret Santa "${title}" !`];
      if (organizer) {
        shareTextParts.push(`Contact : ${organizer}`);
      }
      const shareText = shareTextParts.join(' ');
      const payload = shareUrl ? `${shareText} ${shareUrl}` : shareText;
      const navigatorAvailable = typeof navigator !== 'undefined';
      if (navigatorAvailable && typeof navigator.share === 'function') {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl || undefined,
        });
        setShareState({
          loading: false,
          status: 'Invitation partagée avec succès.',
          error: '',
        });
      } else if (
        navigatorAvailable &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(payload);
        setShareState({
          loading: false,
          status: 'Lien copié dans le presse-papiers !',
          error: '',
        });
      } else {
        setShareState({
          loading: false,
          status: '',
          error: `Copiez et partagez ce message : ${payload}`,
        });
      }
    } catch (error) {
      setShareState({
        loading: false,
        status: '',
        error: error?.message || 'Le partage a échoué.',
      });
    }
  }, [creator?.email, eventSummary]);

  const handleCreateAnotherEvent = () => {
    setEventSummary(null);
    setDrawState(getInitialDrawState());
    setNotificationsState(getInitialNotificationsState());
    setShareState(getInitialShareState());
    navigation.goWizard();
  };

  const formatDateTime = (value) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const translateNotificationStatus = (status) => {
    switch (status) {
      case 'sent':
        return 'Envoyé';
      case 'failed':
        return 'Échec';
      case 'pending':
      default:
        return 'En attente';
    }
  };

  const resolveParticipantLabel = (participantId) => {
    if (!participantId) {
      return 'Participant inconnu';
    }
    const fromNotifications = notificationsState.list?.find(
      (notification) => notification.id === participantId
    );
    if (fromNotifications) {
      return `${fromNotifications.name} — ${fromNotifications.email}`;
    }
    return `Participant #${participantId}`;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    if (!mediaQuery) {
      return undefined;
    }
    const listener = (event) => setSystemPrefersDark(event.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
    } else {
      mediaQuery.addListener(listener);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', listener);
      } else {
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  const resolvedTheme = themePreference === 'system'
    ? systemPrefersDark ? 'dark' : 'light'
    : themePreference;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    setApiAuthToken(authToken);
    if (typeof window === 'undefined') {
      return;
    }
    if (authToken) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }, [authToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (themePreference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    }
  }, [themePreference]);

  const cycleThemePreference = () => {
    setThemePreference((previous) => {
      switch (previous) {
        case 'system':
          return resolvedTheme === 'dark' ? 'light' : 'dark';
        case 'light':
          return 'dark';
        case 'dark':
        default:
          return 'system';
      }
    });
  };

  const themeLabel =
    themePreference === 'system'
      ? `Mode ${resolvedTheme === 'dark' ? 'nuit' : 'jour'} (auto)`
      : `Mode ${themePreference === 'dark' ? 'nuit' : 'jour'}`;

  let content;

  switch (view) {
    case 'auth':
      content = (
        <Auth
          onSuccess={handleAuthSuccess}
          onCancel={navigation.goHome}
        />
      );
      break;
    case 'wizard':
      content = (
        <EventWizard
          creator={creator}
          authToken={authToken}
          onCancel={navigation.goHome}
          onComplete={handleEventComplete}
        />
      );
      break;
    case 'confirmation':
      content = (
        <section className="container py-5" aria-live="polite">
          <div className="card shadow-lg">
            <div className="card-body">
              <h1 className="fs-3 mb-3">Évènement créé avec succès !</h1>
              <p className="text-muted mb-4">
                Votre Secret Santa est prêt. Nous avons bien enregistré la date
                limite, le budget ainsi que la liste des participants.
              </p>
              {eventSummary && (
                <dl className="table-summary mb-4">
                  <div>
                    <dt>Créateur</dt>
                    <dd>{eventSummary.creatorEmail || creator?.email}</dd>
                  </div>
                  <div>
                    <dt>Titre</dt>
                    <dd>{eventSummary.title}</dd>
                  </div>
                  <div>
                    <dt>Date limite</dt>
                    <dd>{eventSummary.deadline}</dd>
                  </div>
                  <div>
                    <dt>Budget maximum</dt>
                    <dd>{eventSummary.budget} €</dd>
                  </div>
                  <div>
                    <dt>Lieu</dt>
                    <dd>{eventSummary.location}</dd>
                  </div>
                  <div>
                    <dt>Participants</dt>
                    <dd>
                      <ul className="list-group">
                        {eventSummary.participants?.map((participant) => (
                          <li className="list-group-item" key={participant.email}>
                            <span>{`${participant.name} — ${participant.email}`}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              )}
              {eventSummary?.id && (
                <section className="mb-4">
                  <h2 className="fs-5 mb-3">Actions rapides</h2>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleTriggerDraw}
                      disabled={drawState.loading}
                    >
                      {drawState.loading ? 'Tirage en cours…' : 'Lancer le tirage'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleViewNotifications}
                      disabled={notificationsState.loading}
                    >
                      {notificationsState.loading
                        ? 'Chargement des envois…'
                        : 'Consulter les envois'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleShareEvent}
                      disabled={shareState.loading}
                    >
                      {shareState.loading ? 'Partage en cours…' : 'Partager l’évènement'}
                    </button>
                  </div>
                  {drawState.error && (
                    <div className="alert alert-danger mt-3" role="alert">
                      {drawState.error}
                    </div>
                  )}
                  {drawState.result && !drawState.error && (
                    <div className="alert alert-success mt-3" role="status">
                      <p className="mb-2">
                        Tirage effectué pour {drawState.result.event?.name || eventSummary.title}.
                      </p>
                      {Array.isArray(drawState.result.status) && drawState.result.status.length > 0 ? (
                        <ul className="list-group">
                          {drawState.result.status.map((item, index) => (
                            <li
                              key={`${item.participantId || 'participant'}-${index}`}
                              className="list-group-item d-flex justify-content-between align-items-start gap-3"
                            >
                              <div className="flex-grow-1">
                                <span className="fw-semibold">
                                  {resolveParticipantLabel(item.participantId)}
                                </span>
                              </div>
                              <div className="text-end">
                                <span
                                  className={`badge ${
                                    item.status === 'sent'
                                      ? 'bg-success'
                                      : item.status === 'failed'
                                        ? 'bg-danger'
                                        : 'bg-secondary'
                                  }`}
                                >
                                  {translateNotificationStatus(item.status)}
                                </span>
                                {item.error && (
                                  <div className="small text-danger mt-1">{item.error}</div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mb-0">Aucune notification envoyée pour le moment.</p>
                      )}
                    </div>
                  )}
                  {notificationsState.error && notificationsState.loaded && (
                    <div className="alert alert-warning mt-3" role="alert">
                      {notificationsState.error}
                    </div>
                  )}
                  {notificationsState.loading && (
                    <p className="text-muted mt-3 mb-0">Chargement des notifications…</p>
                  )}
                  {notificationsState.list && notificationsState.list.length > 0 && (
                    <div className="mt-3">
                      <h3 className="fs-6 mb-2">Historique des envois</h3>
                      <ul className="list-group">
                        {notificationsState.list.map((notification) => (
                          <li
                            key={notification.id}
                            className="list-group-item d-flex justify-content-between align-items-start gap-3"
                          >
                            <div className="flex-grow-1">
                              <div className="fw-semibold">{notification.name}</div>
                              <div className="text-muted small">{notification.email}</div>
                            </div>
                            <div className="text-end">
                              <span
                                className={`badge ${
                                  notification.emailStatus === 'sent'
                                    ? 'bg-success'
                                    : notification.emailStatus === 'failed'
                                      ? 'bg-danger'
                                      : 'bg-secondary'
                                }`}
                              >
                                {translateNotificationStatus(notification.emailStatus)}
                              </span>
                              {notification.emailSentAt && (
                                <div className="text-muted small mt-1">
                                  {formatDateTime(notification.emailSentAt)}
                                </div>
                              )}
                              {notification.emailError && (
                                <div className="text-danger small mt-1">
                                  {notification.emailError}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {notificationsState.loaded &&
                    !notificationsState.loading &&
                    !notificationsState.error &&
                    (!notificationsState.list || notificationsState.list.length === 0) && (
                      <p className="text-muted mt-3 mb-0">
                        Aucun email n’a encore été envoyé.
                      </p>
                    )}
                  {shareState.status && (
                    <div className="alert alert-info mt-3" role="status">
                      {shareState.status}
                    </div>
                  )}
                  {shareState.error && (
                    <div className="alert alert-secondary mt-3" role="alert">
                      {shareState.error}
                    </div>
                  )}
                </section>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateAnotherEvent}
                >
                  Créer un nouvel évènement
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={navigation.goHome}
                >
                  Retourner à l’accueil
                </button>
              </div>
            </div>
          </div>
        </section>
      );
      break;
    case 'home':
    default:
      content = (
        <Home
          onGetStarted={() => {
            if (creator) {
              navigation.goWizard();
            } else {
              navigation.goAuth();
            }
          }}
        />
      );
      break;
  }

  return (
    <div className="app-shell bg-gradient-holiday min-vh-100 d-flex flex-column">
      <header className="app-header navbar">
        <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 py-3">
          <div className="brand">
            <span className="badge-soft" aria-hidden="true">
              🎄 Noël enchanté
            </span>
            <span>Secret Santa Family Link</span>
          </div>
          <div className="nav" aria-label="Navigation principale">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={navigation.goHome}
            >
              Accueil
            </button>
            {creator ? (
              <>
                <span className="text-muted" aria-label="Utilisateur connecté">
                  {creator.email}
                </span>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={handleSignOut}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={navigation.goAuth}
              >
                Connexion
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost theme-toggle"
              onClick={cycleThemePreference}
              aria-label={`Changer le thème (${themeLabel})`}
              title={`Changer le thème (${themeLabel})`}
            >
              <span aria-hidden="true">
                {resolvedTheme === 'dark' ? '🌙' : '☀️'}
              </span>
              <span className="d-none d-md-inline">{themeLabel}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-grow-1">{content}</main>
      <footer className="app-footer">
        <div className="container text-center text-muted py-4">
          © {new Date().getFullYear()} Secret Santa Family Link — Créé avec magie 🎁
        </div>
      </footer>
    </div>
  );
}

export default App;
