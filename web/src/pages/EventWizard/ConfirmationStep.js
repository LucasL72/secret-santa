function ConfirmationStep({
  details,
  participants,
  onBack = () => {},
  onConfirm = () => {},
  loading,
  error,
}) {
  return (
    <div className="ConfirmationStep">
      <h2>Vérifiez les informations</h2>
      <p>
        Assurez-vous que tout est correct avant d’envoyer les invitations aux
        participants. Vous pourrez ensuite suivre l’état des notifications.
      </p>
      <dl className="summary">
        <div>
          <dt>Titre</dt>
          <dd>{details.title}</dd>
        </div>
        <div>
          <dt>Date limite</dt>
          <dd>{details.deadline}</dd>
        </div>
        <div>
          <dt>Budget maximum</dt>
          <dd>{details.budget} €</dd>
        </div>
        <div>
          <dt>Lieu</dt>
          <dd>{details.location}</dd>
        </div>
      </dl>
      <section>
        <h3>Participants ({participants.length})</h3>
        <ul>
          {participants.map((participant) => (
            <li key={participant.email}>
              {participant.name} — {participant.email}
            </li>
          ))}
        </ul>
      </section>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" onClick={onBack} disabled={loading}>
          Retour
        </button>
        <button type="button" onClick={onConfirm} className="primary" disabled={loading}>
          {loading ? 'Création en cours…' : 'Confirmer et envoyer les invitations'}
        </button>
      </div>
    </div>
  );
}

export default ConfirmationStep;
