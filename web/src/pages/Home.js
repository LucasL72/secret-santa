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

const benefits = [
  {
    icon: '⏱️',
    title: 'Gain de temps',
    description:
      'En quelques minutes, vos invitations sont prêtes et vos participants informés des règles.',
  },
  {
    icon: '💌',
    title: 'Invitations personnalisées',
    description:
      'Chaque membre reçoit un message adapté avec son tirage et des rappels automatiques.',
  },
  {
    icon: '📊',
    title: 'Suivi simplifié',
    description:
      'Visualisez qui a accepté, relancez les retardataires et gardez la surprise intacte.',
  },
];

const testimonials = [
  {
    quote:
      'La plateforme a fluidifié nos échanges et tout le monde a reçu son cadeau à temps. Même les plus distraits se sont laissés guider !',
    author: 'Camille',
    role: 'Organisatrice de la famille Bernard',
  },
  {
    quote:
      'On a adoré les invitations personnalisées. Les rappels automatiques ont sauvé notre réveillon.',
    author: 'Nicolas',
    role: 'Papa de trois lutins',
  },
  {
    quote:
      'Un outil intuitif et chaleureux : on a pu se concentrer sur les surprises plutôt que sur la logistique.',
    author: 'Sophie',
    role: 'Tante coordinatrice',
  },
];

function Home({ onGetStarted = () => {}, onViewEvents }) {
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
              {typeof onViewEvents === 'function' && (
                <button
                  type="button"
                  onClick={onViewEvents}
                  className="btn btn-outline-secondary"
                >
                  Mes évènements
                </button>
              )}
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
          <div className="card shadow-lg testimonial-section overflow-hidden">
            <div className="card-body p-4 p-lg-5">
              <div className="row g-4 align-items-center">
                <div className="col-lg-5">
                  <h2 className="fs-3 mb-3">Ils l'ont adopté en famille</h2>
                  <p className="text-muted mb-4">
                    Des parents organisés aux cousins dispersés, tout le monde trouve sa
                    place grâce à Secret Santa Family Link. Inspirez-vous de leurs retours
                    pour créer, vous aussi, un moment magique.
                  </p>
                  <ul className="list-unstyled feature-list mb-0">
                    {benefits.map((benefit) => (
                      <li key={benefit.title} className="d-flex gap-3">
                        <span className="feature-icon" aria-hidden="true">
                          {benefit.icon}
                        </span>
                        <div>
                          <h3 className="fs-6 mb-1">{benefit.title}</h3>
                          <p className="text-muted mb-0">{benefit.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-lg-7">
                  <div className="testimonial-grid">
                    {testimonials.map((testimonial) => (
                      <figure className="testimonial-card" key={testimonial.author}>
                        <blockquote className="testimonial-quote">
                          « {testimonial.quote} »
                        </blockquote>
                        <figcaption className="testimonial-author">
                          <span className="fw-semibold">{testimonial.author}</span>
                          <span className="text-muted">{testimonial.role}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Home;
