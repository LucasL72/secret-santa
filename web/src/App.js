import { useEffect, useMemo, useState } from 'react';
import Home from './pages/Home';
import Auth from './pages/Auth';
import EventWizard from './pages/EventWizard/EventWizard';
import {
  AUTH_TOKEN_STORAGE_KEY,
  setAuthToken as setApiAuthToken,
} from './services/api';
import EventDashboard from './pages/EventDashboard/EventDashboard';

const THEME_STORAGE_KEY = 'ssfl-theme-preference';

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

  const navigation = useMemo(
    () => ({
      goHome: () => {
        setView('home');
        setEventSummary(null);
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
    navigation.goConfirmation();
  };

  const handleSignOut = () => {
    setApiAuthToken(null);
    setCreator(null);
    setEventSummary(null);
    setAuthToken(null);
    navigation.goHome();
  };

  const handleCreateAnotherEvent = () => {
    setEventSummary(null);
    navigation.goWizard();
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
        <EventDashboard
          eventSummary={eventSummary}
          creator={creator}
          authToken={authToken}
          onCreateAnotherEvent={handleCreateAnotherEvent}
          onBackHome={navigation.goHome}
        />
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
