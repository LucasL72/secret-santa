function ConfirmationStep({
  details,
  participants,
  exclusions = [],
  onBack = () => {},
  onConfirm = () => {},
  loading,
  error,
}) {
  const resolveParticipantLabel = (email) => {
    const participant = participants.find((item) => item.email === email);
    if (!participant) {
      return email;
    }
    return `${participant.name} — ${participant.email}`;
  };

  return (
    <div className="confirmation-step d-flex flex-column gap-4">
      <header>
        <h2 className="fs-3 mb-2">Vérifiez les informations</h2>
        <p className="text-muted mb-0">
          Assurez-vous que tout est correct avant d’envoyer les invitations aux
          participants. Vous pourrez ensuite suivre l’état des notifications.
        </p>
      </header>
      <dl className="table-summary">
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
        <h3 className="fs-5 mb-3">Participants ({participants.length})</h3>
        <ul className="list-group">
          {participants.map((participant) => (
            <li className="list-group-item" key={participant.email}>
              {participant.name} — {participant.email}
            </li>
          ))}
        </ul>
      </section>
      {exclusions.length > 0 && (
        <section>
          <h3 className="fs-5 mb-3">Couples exclus</h3>
          <ul className="list-group">
            {exclusions.map((pair) => {
              const key = [pair.participantA, pair.participantB]
                .map((email) => email || '')
                .sort()
                .join('::');
              return (
                <li className="list-group-item" key={key}>
                  {resolveParticipantLabel(pair.participantA)} ⇄{' '}
                  {resolveParticipantLabel(pair.participantB)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" onClick={onBack} disabled={loading} className="btn btn-link">
          Retour
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Création en cours…' : 'Confirmer et envoyer les invitations'}
        </button>
      </div>
    </div>
  );
}

export default ConfirmationStep;
