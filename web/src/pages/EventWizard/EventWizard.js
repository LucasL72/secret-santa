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

function EventWizard({ creator, onCancel = () => {}, onComplete }) {
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
  const [submission, setSubmission] = useState({
    loading: false,
    error: '',
  });

  const goBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleConfirm = async () => {
    setSubmission({ loading: true, error: '' });
    try {
      const payload = {
        ...details,
        budget: Number(details.budget),
        participants,
        creatorId: creator?.id || null,
        creatorEmail: creator?.email || null,
      };
      const response = await createEvent(payload);
      setSubmission({ loading: false, error: '' });
      if (onComplete) {
        onComplete({ ...payload, ...response });
      }
    } catch (error) {
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
            goNext();
          }}
          onCancel={onCancel}
        />
      );
      break;
    case 'participants':
      stepContent = (
        <ParticipantsStep
          participants={participants}
          onUpdate={setParticipants}
          onNext={goNext}
          onBack={goBack}
          onCancel={onCancel}
        />
      );
      break;
    case 'confirmation':
    default:
      stepContent = (
        <ConfirmationStep
          details={details}
          participants={participants}
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
