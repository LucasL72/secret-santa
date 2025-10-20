import { useMemo, useState } from 'react';
import { createEvent } from '../../services/api';
import EventDetailsStep from './EventDetailsStep';
import ParticipantsStep from './ParticipantsStep';
import ConfirmationStep from './ConfirmationStep';

const initialDetails = {
  title: '',
  deadline: '',
  budget: '',
  location: '',
};

function createEmptyServerErrors() {
  return {
    details: {},
    participants: { global: '', fieldErrors: {} },
  };
}

function EventWizard({
  creator,
  authToken,
  onCancel = () => {},
  onComplete,
  onViewEvents,
}) {
  const steps = useMemo(
    () => [
      { id: 'details', label: 'Paramètres' },
      { id: 'participants', label: 'Participants' },
      { id: 'confirmation', label: 'Confirmation' },
    ],
    []
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [details, setDetails] = useState(initialDetails);
  const [participants, setParticipants] = useState([]);
  const [participantExclusions, setParticipantExclusions] = useState([]);
  const [submission, setSubmission] = useState({
    loading: false,
    error: '',
  });
  const [serverValidationErrors, setServerValidationErrors] = useState(() =>
    createEmptyServerErrors()
  );

  const goBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleConfirm = async () => {
    setSubmission({ loading: true, error: '' });
    setServerValidationErrors(createEmptyServerErrors());
    try {
      const normalizedBudget = (() => {
        const rawBudget = String(details.budget ?? '').trim();
        if (!rawBudget) {
          return null;
        }
        const parsedBudget = Number(rawBudget);
        return Number.isFinite(parsedBudget) ? parsedBudget : null;
      })();
      const requestPayload = {
        name: String(details.title || '').trim(),
        eventDate: details.deadline || null,
        budget: normalizedBudget,
        location: String(details.location || '').trim() || null,
        participants,
        exclusions: participantExclusions,
        creatorId: creator?.id || null,
        creatorEmail: creator?.email || null,
      };
      const response = await createEvent(requestPayload, authToken);
      const eventData = response?.event || {};
      const summaryParticipants = Array.isArray(eventData.participants)
        ? eventData.participants
        : participants;
      const summaryExclusions = Array.isArray(eventData.exclusions)
        ? eventData.exclusions
        : Array.isArray(participantExclusions)
        ? participantExclusions
        : [];
      setSubmission({ loading: false, error: '' });
      setServerValidationErrors(createEmptyServerErrors());
      if (onComplete) {
        onComplete({
          title: details.title,
          deadline: details.deadline,
          budget: eventData.budget ?? normalizedBudget,
          location: eventData.location ?? details.location,
          participants: summaryParticipants,
          exclusions: summaryExclusions,
          creatorId: requestPayload.creatorId,
          creatorEmail: requestPayload.creatorEmail,
          name: eventData.name ?? requestPayload.name,
          eventDate: eventData.eventDate ?? requestPayload.eventDate,
          description: eventData.description ?? null,
          id: eventData.id ?? null,
          event: eventData,
        });
      }
    } catch (error) {
      const rawFieldErrors = error?.details?.fieldErrors;
      const fieldErrors =
        rawFieldErrors && typeof rawFieldErrors === 'object' && !Array.isArray(rawFieldErrors)
          ? rawFieldErrors
          : {};
      const targetStep = error?.details?.step;
      const nextServerErrors = createEmptyServerErrors();
      if (targetStep === 'details') {
        nextServerErrors.details = fieldErrors;
      } else if (targetStep === 'participants') {
        const participantFieldErrors = { ...fieldErrors };
        const globalParticipantError =
          participantFieldErrors.participants || error?.message || '';
        delete participantFieldErrors.participants;
        nextServerErrors.participants = {
          global: globalParticipantError,
          fieldErrors: participantFieldErrors,
        };
      }
      if (targetStep) {
        const targetIndex = steps.findIndex((step) => step.id === targetStep);
        if (targetIndex >= 0) {
          setCurrentStep(targetIndex);
        }
      }
      setServerValidationErrors(nextServerErrors);
      setSubmission({
        loading: false,
        error: error?.message || "Une erreur inattendue est survenue.",
      });
    }
  };

  let stepContent;

  switch (steps[currentStep].id) {
    case 'details':
      stepContent = (
        <EventDetailsStep
          initialValues={details}
          onSubmit={(values) => {
            setDetails(values);
            setServerValidationErrors((prev) => ({
              ...prev,
              details: {},
            }));
            goNext();
          }}
          onCancel={onCancel}
          externalErrors={serverValidationErrors.details}
        />
      );
      break;
    case 'participants':
      stepContent = (
        <ParticipantsStep
          participants={participants}
          exclusions={participantExclusions}
          onUpdate={(nextParticipants) => {
            setParticipants(nextParticipants);
            setParticipantExclusions((prev) =>
              prev.filter(
                (pair) =>
                  nextParticipants.some((item) => item.email === pair.participantA) &&
                  nextParticipants.some((item) => item.email === pair.participantB)
              )
            );
          }}
          onExclusionsChange={setParticipantExclusions}
          onNext={() => {
            setServerValidationErrors((prev) => ({
              ...prev,
              participants: { global: '', fieldErrors: {} },
            }));
            goNext();
          }}
          onBack={goBack}
          onCancel={onCancel}
          externalErrors={serverValidationErrors.participants}
        />
      );
      break;
    case 'confirmation':
    default:
      stepContent = (
        <ConfirmationStep
          details={details}
          participants={participants}
          exclusions={participantExclusions}
          onBack={goBack}
          onConfirm={handleConfirm}
          loading={submission.loading}
          error={submission.error}
        />
      );
      break;
  }

  return (
    <section className="event-wizard py-5">
      <div className="container">
        <header className="mb-4 text-center">
          <h1 className="fs-3 mb-2">Assistant de création d’évènement</h1>
          <p className="text-muted mb-0">
            Configurez votre Secret Santa étape par étape. Les informations sont
            sauvegardées à chaque progression.
          </p>
          {typeof onViewEvents === 'function' && (
            <div className="mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onViewEvents}
              >
                Voir mes évènements
              </button>
            </div>
          )}
        </header>
        <ol className="wizard-steps mb-4" role="list">
          {steps.map((step, index) => (
            <li
              key={step.id}
              aria-current={index === currentStep ? 'step' : undefined}
              className={index === currentStep ? 'active' : ''}
            >
              <span className="step-index">{index + 1}</span>
              <span className="step-label">{step.label}</span>
            </li>
          ))}
        </ol>
        <div className="card shadow-lg">
          <div className="card-body">{stepContent}</div>
        </div>
      </div>
    </section>
  );
}

export default EventWizard;
