import { useEffect, useMemo, useState } from 'react';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ParticipantsStep({
  participants,
  exclusions = [],
  onUpdate,
  onExclusionsChange = () => {},
  onNext = () => {},
  onBack = () => {},
  onCancel = () => {},
  externalErrors = { global: '', fieldErrors: {} },
}) {
  const [candidate, setCandidate] = useState({ name: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [pairCandidate, setPairCandidate] = useState({
    participantA: '',
    participantB: '',
  });
  const [exclusionError, setExclusionError] = useState('');

  useEffect(() => {
    const nextFieldErrors = externalErrors.fieldErrors || {};
    setFieldErrors(nextFieldErrors);
    setGlobalError(externalErrors.global || '');
    setExclusionError(nextFieldErrors.exclusions || '');
  }, [externalErrors]);

  useEffect(() => {
    setPairCandidate((previous) => {
      const hasFirst = participants.some(
        (participant) => participant.email === previous.participantA
      );
      const hasSecond = participants.some(
        (participant) => participant.email === previous.participantB
      );
      if (hasFirst && hasSecond) {
        return previous;
      }
      return {
        participantA: hasFirst ? previous.participantA : '',
        participantB: hasSecond ? previous.participantB : '',
      };
    });
  }, [participants]);

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

  const getPairKey = (pair) =>
    [pair.participantA, pair.participantB].map((email) => email || '').sort().join('::');

  const handleCandidateChange = (event) => {
    const { name, value } = event.target;
    setCandidate((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handlePairCandidateChange = (event) => {
    const { name, value } = event.target;
    setPairCandidate((previous) => ({ ...previous, [name]: value }));
    setExclusionError('');
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

  const handleAddExclusion = (event) => {
    event.preventDefault();

    const participantEmails = new Set(participants.map((item) => item.email));
    const first = pairCandidate.participantA;
    const second = pairCandidate.participantB;

    if (!first || !second) {
      setExclusionError('Sélectionnez deux participants à exclure.');
      return;
    }

    if (first === second) {
      setExclusionError('Un participant ne peut pas être jumelé avec lui-même.');
      return;
    }

    if (!participantEmails.has(first) || !participantEmails.has(second)) {
      setExclusionError('Choisissez deux participants valides.');
      return;
    }

    const pairKey = getPairKey({ participantA: first, participantB: second });
    const exists = exclusions.some((pair) => getPairKey(pair) === pairKey);
    if (exists) {
      setExclusionError('Ce couple est déjà défini.');
      return;
    }

    onExclusionsChange([
      ...exclusions,
      { participantA: first, participantB: second },
    ]);
    setPairCandidate({ participantA: '', participantB: '' });
    setExclusionError('');
  };

  const handleRemoveParticipant = (email) => {
    onUpdate(participants.filter((participant) => participant.email !== email));
  };

  const handleRemoveExclusion = (pair) => {
    const targetKey = getPairKey(pair);
    onExclusionsChange(exclusions.filter((item) => getPairKey(item) !== targetKey));
  };

  const handleNext = () => {
    if (participants.length < 2) {
      setGlobalError('Ajoutez au moins deux participants pour lancer un tirage.');
      return;
    }
    setGlobalError('');
    setExclusionError('');
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
            className={`form-control${fieldErrors.name ? ' is-invalid' : ''}`}
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
            className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`}
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
      <section className="ParticipantsStep-exclusions d-flex flex-column gap-3">
        <div>
          <h3 className="fs-5 mb-1">Couples à exclure du tirage</h3>
          <p className="text-muted mb-0">
            Sélectionnez deux participants qui ne doivent pas s’offrir de cadeaux
            entre eux (par exemple les couples).
          </p>
        </div>
        <form className="row g-3 align-items-end" onSubmit={handleAddExclusion}>
          <div className="col-md-4">
            <label className="form-label" htmlFor="exclusion-participant-a">
              Participant 1
            </label>
            <select
              id="exclusion-participant-a"
              name="participantA"
              className="form-select"
              value={pairCandidate.participantA}
              onChange={handlePairCandidateChange}
            >
              <option value="">Sélectionnez un participant</option>
              {sortedParticipants.map((participant) => (
                <option key={`pair-a-${participant.email}`} value={participant.email}>
                  {participant.name} — {participant.email}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="exclusion-participant-b">
              Participant 2
            </label>
            <select
              id="exclusion-participant-b"
              name="participantB"
              className="form-select"
              value={pairCandidate.participantB}
              onChange={handlePairCandidateChange}
            >
              <option value="">Sélectionnez un participant</option>
              {sortedParticipants.map((participant) => (
                <option key={`pair-b-${participant.email}`} value={participant.email}>
                  {participant.name} — {participant.email}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <button type="submit" className="btn btn-secondary w-100" disabled={sortedParticipants.length < 2}>
              Ajouter le couple
            </button>
          </div>
        </form>
        {exclusionError && <div className="form-error">{exclusionError}</div>}
        <div>
          {exclusions.length === 0 ? (
            <p className="text-muted mb-0">Aucun couple exclu pour le moment.</p>
          ) : (
            <ul className="list-group">
              {exclusions.map((pair) => {
                const first = participants.find(
                  (participant) => participant.email === pair.participantA
                );
                const second = participants.find(
                  (participant) => participant.email === pair.participantB
                );
                const firstLabel = first
                  ? `${first.name} — ${first.email}`
                  : pair.participantA;
                const secondLabel = second
                  ? `${second.name} — ${second.email}`
                  : pair.participantB;
                const pairKey = getPairKey(pair);
                return (
                  <li className="list-group-item d-flex justify-content-between align-items-center" key={pairKey}>
                    <span>
                      {firstLabel} ⇄ {secondLabel}
                    </span>
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => handleRemoveExclusion(pair)}
                    >
                      Retirer
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
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
