const steps = [
  {
    title: 'Préparez votre liste',
    description:
      'Rassemblez les adresses e-mail de chaque membre de la famille qui participera au tirage.',
  },
  {
    title: 'Définissez les règles',
    description:
      'Choisissez une date limite pour l’échange, fixez un budget maximum et indiquez le lieu de la remise des cadeaux.',
  },
  {
    title: 'Invitez et suivez',
    description:
      'Ajoutez vos participants, envoyez les invitations et suivez les confirmations directement depuis le tableau de bord.',
  },
];

function Home({ onGetStarted = () => {} }) {
  return (
    <section className="home-view py-5">
      <div className="container">
        <div className="row g-4 align-items-center">
          <div className="col-lg-6">
            <span className="badge-soft mb-3">
              ✨ Nouveauté 2024 · Organisation facilitée
            </span>
            <h1 className="fs-1 lh-sm mb-3">
              Bienvenue sur le
              {' '}
              <span className="holiday-script">Secret Santa Family Link</span>
            </h1>
            <p className="text-muted mb-4">
              Organisez un échange de cadeaux chaleureux et sans stress. Notre
              assistant vous guide pas à pas pour réunir la famille, fixer les
              règles et envoyer toutes les invitations.
            </p>
            <div className="d-flex flex-column flex-md-row gap-3">
              <button type="button" onClick={onGetStarted} className="btn btn-primary">
                Démarrer l’assistant
              </button>
              <div className="d-flex align-items-center gap-2 text-muted">
                <span aria-hidden="true">🎁</span>
                <span>Préparez un Noël inoubliable</span>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="holiday-illustration text-center">
              <div className="snow" aria-hidden="true" />
              <h2 className="fs-3 mb-2">Un thème féérique</h2>
              <p className="mb-3">
                Palette rouge carmin, vert sapin et touches dorées pour
                retranscrire la magie de Noël, même en mode sombre.
              </p>
              <p className="mb-0 fw-semibold">
                <span aria-hidden="true">🌟</span>
                {' '}Illuminez votre famille cette année !
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="holiday-divider" />
          <h2 className="fs-3 text-center mb-4">Comment ça marche ?</h2>
          <div className="row g-4">
            {steps.map((step, index) => (
              <div className="col-lg-4 col-md-6" key={step.title}>
                <div className="card h-100">
                  <div className="card-body">
                    <p className="badge-soft mb-2">
                      {`Étape ${index + 1}`}
                    </p>
                    <h3 className="card-title fs-4">{step.title}</h3>
                    <p className="card-text text-muted">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <div className="card shadow-lg">
            <div className="card-body">
              <h2 className="fs-3 mb-2">Tutoriel détaillé</h2>
              <ol className="timeline mb-0">
                {steps.map((step) => (
                  <li key={`${step.title}-timeline`}>
                    <h3 className="fs-5 mb-1">{step.title}</h3>
                    <p className="text-muted mb-0">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Home;
