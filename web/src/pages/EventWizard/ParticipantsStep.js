import { useMemo, useState } from 'react';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ParticipantsStep({
  participants,
  onUpdate,
  onNext = () => {},
  onBack = () => {},
  onCancel = () => {},
}) {
  const [candidate, setCandidate] = useState({ name: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ),
    [participants]
  );

  const resetCandidate = () => {
    setCandidate({ name: '', email: '' });
    setFieldErrors({});
  };

  const handleCandidateChange = (event) => {
    const { name, value } = event.target;
    setCandidate((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddParticipant = (event) => {
    event.preventDefault();
    const nextErrors = {};
    const trimmedName = candidate.name.trim();
    const normalizedEmail = candidate.email.trim().toLowerCase();

    if (!trimmedName) {
      nextErrors.name = 'Le prénom ou surnom est requis.';
    }
    if (!normalizedEmail) {
      nextErrors.email = "L'adresse e-mail est requise.";
    } else if (!emailRegex.test(normalizedEmail)) {
      nextErrors.email = 'Adresse e-mail invalide.';
    } else if (participants.some((item) => item.email === normalizedEmail)) {
      nextErrors.email = 'Ce participant est déjà présent.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onUpdate([
      ...participants,
      { name: trimmedName, email: normalizedEmail },
    ]);
    setGlobalError('');
    resetCandidate();
  };

  const handleRemoveParticipant = (email) => {
    onUpdate(participants.filter((participant) => participant.email !== email));
  };

  const handleNext = () => {
    if (participants.length < 2) {
      setGlobalError('Ajoutez au moins deux participants pour lancer un tirage.');
      return;
    }
    setGlobalError('');
    onNext();
  };

  return (
    <div className="participants-step d-flex flex-column gap-4">
      <p className="text-muted">
        Ajoutez chaque membre de la famille pour lui attribuer un destinataire
        magique.
      </p>
      <form className="row g-3 align-items-end" onSubmit={handleAddParticipant}>
        <div className="col-md-4">
          <label className="form-label" htmlFor="participant-name">
            Nom
          </label>
          <input
            id="participant-name"
            name="name"
            type="text"
            value={candidate.name}
            onChange={handleCandidateChange}
            placeholder="Ex. Alice"
            className="form-control"
          />
          {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
        </div>
        <div className="col-md-5">
          <label className="form-label" htmlFor="participant-email">
            Adresse e-mail
          </label>
          <input
            id="participant-email"
            name="email"
            type="email"
            value={candidate.email}
            onChange={handleCandidateChange}
            placeholder="alice@example.com"
            className="form-control"
          />
          {fieldErrors.email && <div className="form-error">{fieldErrors.email}</div>}
        </div>
        <div className="col-md-3">
          <button type="submit" className="btn btn-primary w-100">
            Ajouter
          </button>
        </div>
      </form>
      <div className="ParticipantsStep-list" role="group" aria-label="Participants">
        {sortedParticipants.length === 0 ? (
          <p className="text-muted">Vous n’avez pas encore ajouté de participant.</p>
        ) : (
          <ul className="list-group">
            {sortedParticipants.map((participant) => (
              <li className="list-group-item" key={participant.email}>
                <span>
                  {participant.name} — {participant.email}
                </span>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => handleRemoveParticipant(participant.email)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {globalError && (
        <div className="alert" role="alert">
          {globalError}
        </div>
      )}
      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn btn-link">
          Retour
        </button>
        <button type="button" onClick={handleNext} className="btn btn-primary">
          Continuer
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Annuler
        </button>
      </div>
    </div>
  );
}

export default ParticipantsStep;
