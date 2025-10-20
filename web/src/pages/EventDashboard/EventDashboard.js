import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchNotifications,
  triggerDraw as triggerEventDraw,
} from '../../services/api';

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

function EventDashboard({
  eventSummary,
  creator,
  authToken,
  onCreateAnotherEvent,
  onBackHome,
}) {
  const [drawState, setDrawState] = useState(getInitialDrawState);
  const [notificationsState, setNotificationsState] = useState(
    getInitialNotificationsState
  );
  const [shareState, setShareState] = useState(getInitialShareState);

  const eventId = eventSummary?.id || null;

  const participants = useMemo(() => {
    return Array.isArray(eventSummary?.participants)
      ? eventSummary.participants
      : [];
  }, [eventSummary?.participants]);

  const resolveParticipantLabel = useCallback(
    (participantId) => {
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
    },
    [notificationsState.list]
  );

  const loadNotifications = useCallback(async () => {
    if (!eventId) {
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
      const response = await fetchNotifications(eventId, authToken);
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
  }, [authToken, eventId]);

  const handleTriggerDraw = useCallback(async () => {
    if (!eventId) {
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
      const response = await triggerEventDraw(eventId, authToken);
      setDrawState({ loading: false, error: '', result: response });
      await loadNotifications();
    } catch (error) {
      setDrawState({
        loading: false,
        error: error?.message || 'Le tirage a échoué.',
        result: null,
      });
    }
  }, [authToken, eventId, loadNotifications]);

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
        typeof window !== 'undefined' && eventId
          ? `${window.location.origin}/events/${eventId}`
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
  }, [creator?.email, eventId, eventSummary]);

  useEffect(() => {
    setDrawState(getInitialDrawState());
    setNotificationsState(getInitialNotificationsState());
    setShareState(getInitialShareState());
  }, [eventId]);

  return (
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
                    {participants.map((participant) => (
                      <li className="list-group-item" key={participant.email}>
                        <span>{`${participant.name} — ${participant.email}`}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          )}
          {eventId && (
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
              onClick={onCreateAnotherEvent}
            >
              Créer un nouvel évènement
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBackHome}
            >
              Retourner à l’accueil
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EventDashboard;
