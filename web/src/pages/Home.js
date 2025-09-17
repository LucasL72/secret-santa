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
    <section className="Home">
      <header className="Home-hero">
        <h1>Bienvenue sur le Secret Santa Family Link</h1>
        <p>
          Organisez un échange de cadeaux mémorable en quelques minutes grâce à
          notre assistant guidé pas à pas.
        </p>
        <button type="button" onClick={onGetStarted} className="primary">
          Démarrer
        </button>
      </header>
      <article className="Home-tutorial">
        <h2>Tutoriel détaillé</h2>
        <ol>
          {steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
        <p>
          Une fois vos paramètres sauvegardés, Secret Santa Family Link se
          charge de notifier chaque participant de son destinataire secret et
          vous informe en cas de message ou de retard.
        </p>
      </article>
    </section>
  );
}

export default Home;
