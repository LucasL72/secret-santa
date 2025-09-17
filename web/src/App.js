import { useMemo, useState } from 'react';
import './App.css';
import Home from './pages/Home';
import Auth from './pages/Auth';
import EventWizard from './pages/EventWizard/EventWizard';

function App() {
  const [view, setView] = useState('home');
  const [creator, setCreator] = useState(null);
  const [eventSummary, setEventSummary] = useState(null);

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

  const handleAuthSuccess = (account) => {
    setCreator(account);
    navigation.goWizard();
  };

  const handleEventComplete = (summary) => {
    setEventSummary(summary);
    navigation.goConfirmation();
  };

  const handleSignOut = () => {
    setCreator(null);
    setEventSummary(null);
    navigation.goHome();
  };

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
          onCancel={navigation.goHome}
          onComplete={handleEventComplete}
        />
      );
      break;
    case 'confirmation':
      content = (
        <section className="App-confirmation" aria-live="polite">
          <h1>Évènement créé avec succès !</h1>
          <p>
            Votre Secret Santa est prêt. Nous avons bien enregistré la date
            limite, le budget ainsi que la liste des participants.
          </p>
          {eventSummary && (
            <dl className="App-summary">
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
                  <ul>
                    {eventSummary.participants?.map((participant) => (
                      <li key={participant.email}>{`${participant.name} - ${participant.email}`}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          )}
          <div className="App-actions">
            <button type="button" onClick={navigation.goWizard}>
              Créer un nouvel évènement
            </button>
            <button type="button" onClick={navigation.goHome}>
              Retourner à l’accueil
            </button>
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
    <div className="App">
      <header className="App-header">
        <div className="App-brand">Secret Santa Family Link</div>
        <nav className="App-nav" aria-label="Navigation principale">
          <button type="button" onClick={navigation.goHome}>
            Accueil
          </button>
          {creator ? (
            <>
              <span className="App-user">{creator.email}</span>
              <button type="button" onClick={handleSignOut}>
                Déconnexion
              </button>
            </>
          ) : (
            <button type="button" onClick={navigation.goAuth}>
              Connexion
            </button>
          )}
        </nav>
      </header>
      <main className="App-main">{content}</main>
      <footer className="App-footer">
        © {new Date().getFullYear()} Secret Santa Family Link
      </footer>
    </div>
  );
}

export default App;
