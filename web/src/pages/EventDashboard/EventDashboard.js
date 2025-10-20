import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acknowledgeNotification as acknowledgeNotificationRequest,
  fetchNotifications,
  resendNotification as resendNotificationRequest,
  triggerDraw as triggerEventDraw,
  updateEventDetails as updateEventDetailsRequest,
  updateEventParticipants as updateEventParticipantsRequest,
} from '../../services/api';

const getInitialDrawState = () => ({
  loading: false,
  error: '',
  result: null,
});

const getInitialNotificationsState = () => ({
  loading: false,
  error: '',
  list: null,
  loaded: false,
});

const getInitialShareState = () => ({
  loading: false,
  status: '',
  error: '',
});

const defaultNotificationActionState = Object.freeze({
  acknowledging: false,
  resending: false,
  message: '',
  error: '',
});

const translateNotificationStatus = (status) => {
  switch (status) {
    case 'read':
      return 'Lu';
    case 'sent':
      return 'Envoyé';
    case 'failed':
      return 'Échec';
    case 'pending':
    default:
      return 'En attente';
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeDateInputValue = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const day = `${parsed.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const buildDetailsFormFromEvent = (summary) => ({
  title: String(summary?.title ?? summary?.name ?? '').trim(),
  deadline: normalizeDateInputValue(summary?.deadline ?? summary?.eventDate ?? ''),
  budget:
    summary?.budget !== undefined && summary?.budget !== null
      ? String(summary.budget)
      : '',
  location: String(summary?.location ?? ''),
});

const buildParticipantsFromEvent = (summary) => {
  if (!Array.isArray(summary?.participants)) {
    return [];
  }
  return summary.participants.map((participant) => ({
    name: String(participant?.name ?? ''),
    email: String(participant?.email ?? ''),
  }));
};

function EventDashboard({
  eventSummary,
  creator,
  authToken,
  onCreateAnotherEvent,
  onBackHome,
}) {
  const [currentEvent, setCurrentEvent] = useState(eventSummary || null);
  const [drawState, setDrawState] = useState(getInitialDrawState);
  const [notificationsState, setNotificationsState] = useState(
    getInitialNotificationsState
  );
  const [notificationsFilter, setNotificationsFilter] = useState('all');
  const [notificationActions, setNotificationActions] = useState({});
  const [shareState, setShareState] = useState(getInitialShareState);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState(() =>
    buildDetailsFormFromEvent(eventSummary)
  );
  const [detailsErrors, setDetailsErrors] = useState({});
  const [detailsStatus, setDetailsStatus] = useState({
    saving: false,
    success: '',
    error: '',
  });
  const [isEditingParticipants, setIsEditingParticipants] = useState(false);
  const [participantsForm, setParticipantsForm] = useState(() =>
    buildParticipantsFromEvent(eventSummary)
  );
  const [participantsErrors, setParticipantsErrors] = useState({
    global: '',
    items: {},
  });
  const [participantsStatus, setParticipantsStatus] = useState({
    saving: false,
    success: '',
    error: '',
  });

  const eventId = currentEvent?.id || null;

  const participants = useMemo(() => {
    return Array.isArray(currentEvent?.participants)
      ? currentEvent.participants
      : [];
  }, [currentEvent?.participants]);

  const filteredNotifications = useMemo(() => {
    const list = Array.isArray(notificationsState.list)
      ? notificationsState.list
      : [];
    switch (notificationsFilter) {
      case 'unread':
        return list.filter((notification) => notification.emailStatus !== 'read');
      case 'sent':
      case 'failed':
      case 'pending':
      case 'read':
        return list.filter(
          (notification) => notification.emailStatus === notificationsFilter
        );
      case 'all':
      default:
        return list;
    }
  }, [notificationsFilter, notificationsState.list]);

  const hasNotifications = useMemo(() => {
    return Array.isArray(notificationsState.list) && notificationsState.list.length > 0;
  }, [notificationsState.list]);

  useEffect(() => {
    setCurrentEvent(eventSummary || null);
  }, [eventSummary]);

  useEffect(() => {
    if (!isEditingDetails) {
      setDetailsForm(buildDetailsFormFromEvent(currentEvent));
      setDetailsErrors({});
    }
  }, [currentEvent, isEditingDetails]);

  useEffect(() => {
    if (!isEditingParticipants) {
      setParticipantsForm(buildParticipantsFromEvent(currentEvent));
      setParticipantsErrors({ global: '', items: {} });
    }
  }, [currentEvent, isEditingParticipants]);

  const resolveParticipantLabel = useCallback(
    (participantId) => {
      if (!participantId) {
        return 'Participant inconnu';
      }
      const fromNotifications = notificationsState.list?.find(
        (notification) => notification.id === participantId
      );
      if (fromNotifications) {
        return `${fromNotifications.name} — ${fromNotifications.email}`;
      }
      return `Participant #${participantId}`;
    },
    [notificationsState.list]
  );

  const loadNotifications = useCallback(async () => {
    if (!eventId) {
      setNotificationsState({
        loading: false,
        error: "Identifiant de l’évènement introuvable.",
        list: null,
        loaded: true,
      });
      return;
    }
    if (!authToken) {
      setNotificationsState({
        loading: false,
        error: 'Authentification requise pour consulter les envois.',
        list: null,
        loaded: true,
      });
      return;
    }
    setNotificationsState((previous) => ({
      ...previous,
      loading: true,
      error: '',
      loaded: true,
    }));
    try {
      const response = await fetchNotifications(eventId, authToken);
      setNotificationsState({
        loading: false,
        error: '',
        list: response?.notifications || [],
        loaded: true,
      });
    } catch (error) {
      setNotificationsState({
        loading: false,
        error: error?.message || 'Impossible de récupérer les envois.',
        list: null,
        loaded: true,
      });
    }
  }, [authToken, eventId]);

  const setNotificationActionState = useCallback((notificationId, partialState) => {
    setNotificationActions((previous) => {
      const current =
        previous[notificationId] ||
        {
          acknowledging: false,
          resending: false,
          message: '',
          error: '',
        };
      const next = { ...current, ...partialState };
      if (
        !next.acknowledging &&
        !next.resending &&
        !next.message &&
        !next.error
      ) {
        const { [notificationId]: _removed, ...rest } = previous;
        return rest;
      }
      return {
        ...previous,
        [notificationId]: next,
      };
    });
  }, []);

  const updateNotificationInState = useCallback((notificationId, updater) => {
    setNotificationsState((previous) => {
      if (!Array.isArray(previous.list)) {
        return previous;
      }
      const nextList = previous.list.map((notification) => {
        if (notification.id !== notificationId) {
          return notification;
        }
        const patch = typeof updater === 'function' ? updater(notification) : updater;
        return { ...notification, ...patch };
      });
      return {
        ...previous,
        list: nextList,
      };
    });
  }, []);

  const handleDetailsFieldChange = (event) => {
    const { name, value } = event.target;
    setDetailsForm((previous) => ({ ...previous, [name]: value }));
    setDetailsErrors((previous) => {
      if (!previous[name]) {
        return previous;
      }
      const nextErrors = { ...previous };
      delete nextErrors[name];
      return nextErrors;
    });
    setDetailsStatus((previous) => ({ ...previous, error: '' }));
  };

  const validateDetailsForm = useCallback(() => {
    const nextErrors = {};
    const trimmedTitle = String(detailsForm.title || '').trim();
    if (!trimmedTitle) {
      nextErrors.title = 'Indiquez un nom reconnaissable pour votre évènement.';
    }

    if (!detailsForm.deadline) {
      nextErrors.deadline = 'La date limite est obligatoire.';
    } else {
      const deadlineDate = new Date(detailsForm.deadline);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (Number.isNaN(deadlineDate.getTime())) {
        nextErrors.deadline = 'La date limite doit être valide.';
      } else if (deadlineDate < now) {
        nextErrors.deadline = 'La date doit être dans le futur.';
      }
    }

    if (!detailsForm.budget) {
      nextErrors.budget = 'Le budget maximum est obligatoire.';
    } else if (
      Number.isNaN(Number(detailsForm.budget)) ||
      Number(detailsForm.budget) <= 0
    ) {
      nextErrors.budget = 'Le budget doit être un montant positif.';
    }

    const trimmedLocation = String(detailsForm.location || '').trim();
    if (!trimmedLocation) {
      nextErrors.location = 'Merci de préciser le lieu de remise des cadeaux.';
    }

    setDetailsErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      title: trimmedTitle,
      deadline: detailsForm.deadline,
      budget: Number(detailsForm.budget),
      location: trimmedLocation,
    };
  }, [detailsForm]);

  const handleSubmitDetails = async (submitEvent) => {
    submitEvent.preventDefault();
    const normalized = validateDetailsForm();
    if (!normalized) {
      return;
    }

    if (!eventId) {
      setDetailsStatus({
        saving: false,
        success: '',
        error: "Identifiant de l’évènement introuvable.",
      });
      return;
    }

    if (!authToken) {
      setDetailsStatus({
        saving: false,
        success: '',
        error: 'Authentification requise pour modifier les détails.',
      });
      return;
    }

    setDetailsStatus({ saving: true, success: '', error: '' });
    try {
      const response = await updateEventDetailsRequest(
        eventId,
        {
          name: normalized.title,
          eventDate: normalized.deadline || null,
          budget: normalized.budget,
          location: normalized.location,
        },
        authToken
      );
      const updatedEvent = response?.event || {};
      const baseEvent = currentEvent ? { ...currentEvent } : {};
      const nextEvent = {
        ...baseEvent,
        ...updatedEvent,
        title: updatedEvent.name ?? normalized.title,
        name: updatedEvent.name ?? normalized.title,
        deadline: normalizeDateInputValue(
          updatedEvent.eventDate ?? normalized.deadline
        ),
        eventDate: updatedEvent.eventDate ?? baseEvent.eventDate ?? null,
        budget: updatedEvent.budget ?? normalized.budget,
        location: updatedEvent.location ?? normalized.location,
        description:
          updatedEvent.description ?? baseEvent.description ?? null,
      };
      setCurrentEvent(nextEvent);
      setDetailsErrors({});
      setIsEditingDetails(false);
      setDetailsStatus({
        saving: false,
        success: 'Détails mis à jour avec succès.',
        error: '',
      });
    } catch (error) {
      const fieldErrors =
        error?.details?.fieldErrors &&
        typeof error.details.fieldErrors === 'object'
          ? error.details.fieldErrors
          : {};
      const nextErrors = {};
      if (fieldErrors.title) {
        nextErrors.title = fieldErrors.title;
      }
      if (fieldErrors.deadline) {
        nextErrors.deadline = fieldErrors.deadline;
      }
      if (fieldErrors.budget) {
        nextErrors.budget = fieldErrors.budget;
      }
      if (fieldErrors.location) {
        nextErrors.location = fieldErrors.location;
      }
      if (Object.keys(nextErrors).length > 0) {
        setDetailsErrors(nextErrors);
      }
      setDetailsStatus({
        saving: false,
        success: '',
        error:
          error?.message ||
          "Impossible de mettre à jour les détails de l’évènement.",
      });
    }
  };

  const handleStartEditDetails = () => {
    setDetailsForm(buildDetailsFormFromEvent(currentEvent));
    setDetailsErrors({});
    setDetailsStatus((previous) => ({ ...previous, error: '', success: '' }));
    setIsEditingDetails(true);
  };

  const handleCancelEditDetails = () => {
    setDetailsForm(buildDetailsFormFromEvent(currentEvent));
    setDetailsErrors({});
    setDetailsStatus((previous) => ({ ...previous, error: '' }));
    setIsEditingDetails(false);
  };

  const handleParticipantFieldChange = (index, field, value) => {
    setParticipantsForm((previous) =>
      previous.map((participant, idx) =>
        idx === index ? { ...participant, [field]: value } : participant
      )
    );
    setParticipantsErrors((previous) => {
      const nextItems = { ...previous.items };
      if (nextItems[index]) {
        const nextFieldErrors = { ...nextItems[index] };
        delete nextFieldErrors[field];
        if (Object.keys(nextFieldErrors).length === 0) {
          delete nextItems[index];
        } else {
          nextItems[index] = nextFieldErrors;
        }
      }
      return { global: '', items: nextItems };
    });
    setParticipantsStatus((previous) => ({ ...previous, error: '' }));
  };

  const handleAddParticipantRow = () => {
    setParticipantsForm((previous) => [...previous, { name: '', email: '' }]);
    setParticipantsErrors((previous) => ({ ...previous, global: '' }));
  };

  const handleRemoveParticipantRow = (index) => {
    setParticipantsForm((previous) =>
      previous.filter((_, idx) => idx !== index)
    );
    setParticipantsErrors((previous) => {
      const nextItems = {};
      Object.entries(previous.items).forEach(([key, value]) => {
        const numericKey = Number(key);
        if (Number.isNaN(numericKey) || numericKey === index) {
          return;
        }
        const nextKey = numericKey > index ? numericKey - 1 : numericKey;
        nextItems[nextKey] = value;
      });
      return { global: '', items: nextItems };
    });
    setParticipantsStatus((previous) => ({ ...previous, error: '' }));
  };

  const validateParticipantsForm = useCallback(() => {
    const nextErrors = { global: '', items: {} };
    const emailOccurrences = new Map();

    participantsForm.forEach((participant, index) => {
      const trimmedName = String(participant?.name ?? '').trim();
      const rawEmail = String(participant?.email ?? '').trim();
      const itemErrors = {};

      if (!trimmedName) {
        itemErrors.name = 'Le prénom ou surnom est requis.';
      }

      if (!rawEmail) {
        itemErrors.email = "L'adresse e-mail est requise.";
      } else if (!emailRegex.test(rawEmail)) {
        itemErrors.email = 'Adresse e-mail invalide.';
      }

      if (rawEmail) {
        const normalizedEmail = rawEmail.toLowerCase();
        const indexes = emailOccurrences.get(normalizedEmail) || [];
        indexes.push(index);
        emailOccurrences.set(normalizedEmail, indexes);
      }

      if (Object.keys(itemErrors).length > 0) {
        nextErrors.items[index] = itemErrors;
      }
    });

    emailOccurrences.forEach((indexes, email) => {
      if (!email || indexes.length < 2) {
        return;
      }
      indexes.forEach((participantIndex) => {
        const existingErrors = nextErrors.items[participantIndex] || {};
        if (
          !existingErrors.email ||
          existingErrors.email === "L'adresse e-mail est requise."
        ) {
          nextErrors.items[participantIndex] = {
            ...existingErrors,
            email: 'Ce participant est déjà présent.',
          };
        }
      });
    });

    const normalizedParticipants = participantsForm
      .map((participant, index) => {
        if (nextErrors.items[index]) {
          return null;
        }
        return {
          name: String(participant?.name ?? '').trim(),
          email: String(participant?.email ?? '').trim().toLowerCase(),
        };
      })
      .filter(Boolean);

    if (participantsForm.length < 2) {
      nextErrors.global =
        'Ajoutez au moins deux participants pour lancer un tirage.';
    } else if (normalizedParticipants.length < 2) {
      nextErrors.global =
        'Ajoutez au moins deux participants valides pour lancer un tirage.';
    }

    setParticipantsErrors(nextErrors);
    return {
      valid: Object.keys(nextErrors.items).length === 0 && !nextErrors.global,
      participants: normalizedParticipants,
    };
  }, [participantsForm]);

  const handleSubmitParticipants = async (submitEvent) => {
    submitEvent.preventDefault();
    const validation = validateParticipantsForm();
    if (!validation.valid) {
      return;
    }

    if (!eventId) {
      setParticipantsStatus({
        saving: false,
        success: '',
        error: "Identifiant de l’évènement introuvable.",
      });
      return;
    }

    if (!authToken) {
      setParticipantsStatus({
        saving: false,
        success: '',
        error: 'Authentification requise pour modifier les participants.',
      });
      return;
    }

    setParticipantsStatus({ saving: true, success: '', error: '' });
    try {
      const response = await updateEventParticipantsRequest(
        eventId,
        validation.participants,
        authToken
      );
      const savedParticipants = Array.isArray(response?.participants)
        ? response.participants
        : validation.participants;
      const baseEvent = currentEvent ? { ...currentEvent } : {};
      const nextEvent = {
        ...baseEvent,
        participants: savedParticipants,
      };
      setCurrentEvent(nextEvent);
      setIsEditingParticipants(false);
      setParticipantsErrors({ global: '', items: {} });
      setParticipantsStatus({
        saving: false,
        success: 'Participants mis à jour avec succès.',
        error: '',
      });
    } catch (error) {
      const fieldErrors =
        error?.details?.fieldErrors &&
        typeof error.details.fieldErrors === 'object'
          ? error.details.fieldErrors
          : {};
      const globalError = fieldErrors.participants || '';
      setParticipantsErrors((previous) => ({
        global: globalError || previous.global,
        items: { ...previous.items },
      }));
      setParticipantsStatus({
        saving: false,
        success: '',
        error:
          error?.message ||
          'Impossible de mettre à jour la liste des participants.',
      });
    }
  };

  const handleStartEditParticipants = () => {
    setParticipantsForm(buildParticipantsFromEvent(currentEvent));
    setParticipantsErrors({ global: '', items: {} });
    setParticipantsStatus((previous) => ({ ...previous, error: '', success: '' }));
    setIsEditingParticipants(true);
  };

  const handleCancelEditParticipants = () => {
    setParticipantsForm(buildParticipantsFromEvent(currentEvent));
    setParticipantsErrors({ global: '', items: {} });
    setParticipantsStatus((previous) => ({ ...previous, error: '' }));
    setIsEditingParticipants(false);
  };

  const handleTriggerDraw = useCallback(async () => {
    if (!eventId) {
      setDrawState({
        loading: false,
        error: "Impossible de lancer le tirage sans identifiant d’évènement.",
        result: null,
      });
      return;
    }
    if (!authToken) {
      setDrawState({
        loading: false,
        error: 'Veuillez vous reconnecter pour lancer le tirage.',
        result: null,
      });
      return;
    }
    setDrawState({ loading: true, error: '', result: null });
    try {
      const response = await triggerEventDraw(eventId, authToken);
      setDrawState({ loading: false, error: '', result: response });
      await loadNotifications();
    } catch (error) {
      setDrawState({
        loading: false,
        error: error?.message || 'Le tirage a échoué.',
        result: null,
      });
    }
  }, [authToken, eventId, loadNotifications]);

  const handleViewNotifications = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkNotificationAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) {
        return;
      }
      setNotificationActionState(notificationId, {
        acknowledging: true,
        message: '',
        error: '',
      });
      if (!eventId) {
        setNotificationActionState(notificationId, {
          acknowledging: false,
          error: "Identifiant de l’évènement introuvable.",
        });
        return;
      }
      if (!authToken) {
        setNotificationActionState(notificationId, {
          acknowledging: false,
          error: 'Veuillez vous reconnecter pour mettre à jour la notification.',
        });
        return;
      }
      try {
        await acknowledgeNotificationRequest(eventId, notificationId, authToken);
        updateNotificationInState(notificationId, { emailStatus: 'read' });
        await loadNotifications();
        setNotificationActionState(notificationId, {
          acknowledging: false,
          message: 'Notification marquée comme lue.',
          error: '',
        });
      } catch (error) {
        setNotificationActionState(notificationId, {
          acknowledging: false,
          error:
            error?.message ||
            "Impossible de mettre à jour le statut de la notification.",
        });
      }
    },
    [
      authToken,
      eventId,
      loadNotifications,
      setNotificationActionState,
      updateNotificationInState,
    ]
  );

  const handleResendNotification = useCallback(
    async (notification) => {
      if (!notification?.id) {
        return;
      }
      const notificationId = notification.id;
      setNotificationActionState(notificationId, {
        resending: true,
        message: '',
        error: '',
      });
      if (!eventId) {
        setNotificationActionState(notificationId, {
          resending: false,
          error: "Identifiant de l’évènement introuvable.",
        });
        return;
      }
      if (!authToken) {
        setNotificationActionState(notificationId, {
          resending: false,
          error: 'Veuillez vous reconnecter pour relancer la notification.',
        });
        return;
      }
      if (!notification.email) {
        setNotificationActionState(notificationId, {
          resending: false,
          error: 'Adresse email du participant introuvable.',
        });
        return;
      }
      try {
        const response = await resendNotificationRequest(
          eventId,
          notification.email,
          authToken
        );
        const sentAt = response?.notification?.sentAt || null;
        updateNotificationInState(notificationId, {
          emailStatus: 'sent',
          emailError: '',
          emailSentAt: sentAt,
        });
        await loadNotifications();
        setNotificationActionState(notificationId, {
          resending: false,
          message: 'Notification renvoyée avec succès.',
          error: '',
        });
      } catch (error) {
        setNotificationActionState(notificationId, {
          resending: false,
          error:
            error?.message || "Impossible de renvoyer la notification.",
        });
      }
    },
    [
      authToken,
      eventId,
      loadNotifications,
      setNotificationActionState,
      updateNotificationInState,
    ]
  );

  const handleShareEvent = useCallback(async () => {
    if (!currentEvent) {
      setShareState({
        loading: false,
        status: '',
        error: "Impossible de partager un évènement introuvable.",
      });
      return;
    }
    setShareState({ loading: true, status: '', error: '' });
    try {
      const title = currentEvent.name || currentEvent.title || 'Secret Santa';
      const organizer = currentEvent.creatorEmail || creator?.email || '';
      const shareUrl =
        typeof window !== 'undefined' && eventId
          ? `${window.location.origin}/events/${eventId}`
          : '';
      const shareTextParts = [`Participez à mon Secret Santa "${title}" !`];
      if (organizer) {
        shareTextParts.push(`Contact : ${organizer}`);
      }
      const shareText = shareTextParts.join(' ');
      const payload = shareUrl ? `${shareText} ${shareUrl}` : shareText;
      const navigatorAvailable = typeof navigator !== 'undefined';
      if (navigatorAvailable && typeof navigator.share === 'function') {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl || undefined,
        });
        setShareState({
          loading: false,
          status: 'Invitation partagée avec succès.',
          error: '',
        });
      } else if (
        navigatorAvailable &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(payload);
        setShareState({
          loading: false,
          status: 'Lien copié dans le presse-papiers !',
          error: '',
        });
      } else {
        setShareState({
          loading: false,
          status: '',
          error: `Copiez et partagez ce message : ${payload}`,
        });
      }
    } catch (error) {
      setShareState({
        loading: false,
        status: '',
        error: error?.message || 'Le partage a échoué.',
      });
    }
  }, [creator?.email, currentEvent, eventId]);

  useEffect(() => {
    setDrawState(getInitialDrawState());
    setNotificationsState(getInitialNotificationsState());
    setShareState(getInitialShareState());
    setNotificationsFilter('all');
    setNotificationActions({});
  }, [eventId]);

  return (
    <section className="container py-5" aria-live="polite">
      <div className="card shadow-lg">
        <div className="card-body">
          <h1 className="fs-3 mb-3">Évènement créé avec succès !</h1>
          <p className="text-muted mb-4">
            Votre Secret Santa est prêt. Nous avons bien enregistré la date
            limite, le budget ainsi que la liste des participants.
          </p>
          <section className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="fs-5 mb-0">Détails de l’évènement</h2>
              {currentEvent && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={
                    isEditingDetails ? handleCancelEditDetails : handleStartEditDetails
                  }
                  disabled={detailsStatus.saving}
                >
                  {isEditingDetails ? 'Fermer' : 'Modifier'}
                </button>
              )}
            </div>
            {detailsStatus.success && !isEditingDetails && (
              <div className="alert alert-success" role="status">
                {detailsStatus.success}
              </div>
            )}
            {detailsStatus.error && !isEditingDetails && (
              <div className="alert alert-danger" role="alert">
                {detailsStatus.error}
              </div>
            )}
            {isEditingDetails ? (
              <form
                className="d-flex flex-column gap-3"
                onSubmit={handleSubmitDetails}
                noValidate
              >
                <div>
                  <label className="form-label" htmlFor="dashboard-title">
                    Nom de l’évènement
                  </label>
                  <input
                    id="dashboard-title"
                    name="title"
                    type="text"
                    value={detailsForm.title}
                    onChange={handleDetailsFieldChange}
                    className={`form-control${detailsErrors.title ? ' is-invalid' : ''}`}
                    placeholder="Secret Santa de la famille"
                    disabled={detailsStatus.saving}
                  />
                  {detailsErrors.title && (
                    <div className="form-error">{detailsErrors.title}</div>
                  )}
                </div>
                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="dashboard-deadline">
                      Date limite d’envoi
                    </label>
                    <input
                      id="dashboard-deadline"
                      name="deadline"
                      type="date"
                      value={detailsForm.deadline}
                      onChange={handleDetailsFieldChange}
                      className={`form-control${detailsErrors.deadline ? ' is-invalid' : ''}`}
                      disabled={detailsStatus.saving}
                    />
                    {detailsErrors.deadline && (
                      <div className="form-error">{detailsErrors.deadline}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="dashboard-budget">
                      Budget maximum (en €)
                    </label>
                    <input
                      id="dashboard-budget"
                      name="budget"
                      type="number"
                      min="1"
                      step="1"
                      value={detailsForm.budget}
                      onChange={handleDetailsFieldChange}
                      className={`form-control${detailsErrors.budget ? ' is-invalid' : ''}`}
                      disabled={detailsStatus.saving}
                    />
                    {detailsErrors.budget && (
                      <div className="form-error">{detailsErrors.budget}</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="form-label" htmlFor="dashboard-location">
                    Lieu de l’échange
                  </label>
                  <input
                    id="dashboard-location"
                    name="location"
                    type="text"
                    value={detailsForm.location}
                    onChange={handleDetailsFieldChange}
                    className={`form-control${detailsErrors.location ? ' is-invalid' : ''}`}
                    placeholder="Chez Mamie, 24 décembre"
                    disabled={detailsStatus.saving}
                  />
                  {detailsErrors.location && (
                    <div className="form-error">{detailsErrors.location}</div>
                  )}
                </div>
                {detailsStatus.error && isEditingDetails && (
                  <div className="alert alert-danger" role="alert">
                    {detailsStatus.error}
                  </div>
                )}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleCancelEditDetails}
                    disabled={detailsStatus.saving}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={detailsStatus.saving}
                  >
                    {detailsStatus.saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            ) : currentEvent ? (
              <dl className="table-summary mb-0">
                <div>
                  <dt>Créateur</dt>
                  <dd>{currentEvent.creatorEmail || creator?.email}</dd>
                </div>
                <div>
                  <dt>Titre</dt>
                  <dd>{currentEvent.title || currentEvent.name}</dd>
                </div>
                <div>
                  <dt>Date limite</dt>
                  <dd>{formatDate(currentEvent.deadline || currentEvent.eventDate)}</dd>
                </div>
                <div>
                  <dt>Budget maximum</dt>
                  <dd>
                    {currentEvent.budget !== undefined && currentEvent.budget !== null
                      ? `${currentEvent.budget} €`
                      : 'Non défini'}
                  </dd>
                </div>
                <div>
                  <dt>Lieu</dt>
                  <dd>{currentEvent.location || 'Non défini'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted mb-0">
                Aucun évènement sélectionné pour le moment.
              </p>
            )}
          </section>
          <section className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="fs-5 mb-0">Participants</h2>
              {currentEvent && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={
                    isEditingParticipants
                      ? handleCancelEditParticipants
                      : handleStartEditParticipants
                  }
                  disabled={participantsStatus.saving}
                >
                  {isEditingParticipants ? 'Fermer' : 'Modifier la liste'}
                </button>
              )}
            </div>
            {participantsStatus.success && !isEditingParticipants && (
              <div className="alert alert-success" role="status">
                {participantsStatus.success}
              </div>
            )}
            {participantsStatus.error && !isEditingParticipants && (
              <div className="alert alert-danger" role="alert">
                {participantsStatus.error}
              </div>
            )}
            {isEditingParticipants ? (
              <form
                className="d-flex flex-column gap-3"
                onSubmit={handleSubmitParticipants}
                noValidate
              >
                <div className="d-flex flex-column gap-3">
                  {participantsForm.length === 0 ? (
                    <p className="text-muted mb-0">
                      Ajoutez vos premiers participants pour lancer le tirage.
                    </p>
                  ) : (
                    participantsForm.map((participant, index) => (
                      <div className="row g-3 align-items-end" key={`participant-${index}`}>
                        <div className="col-md-5">
                          <label className="form-label" htmlFor={`participant-name-${index}`}>
                            Nom
                          </label>
                          <input
                            id={`participant-name-${index}`}
                            name="name"
                            type="text"
                            value={participant.name}
                            onChange={(event) =>
                              handleParticipantFieldChange(index, 'name', event.target.value)
                            }
                            className={`form-control${
                              participantsErrors.items?.[index]?.name ? ' is-invalid' : ''
                            }`}
                            placeholder="Ex. Alice"
                            disabled={participantsStatus.saving}
                          />
                          {participantsErrors.items?.[index]?.name && (
                            <div className="form-error">
                              {participantsErrors.items?.[index]?.name}
                            </div>
                          )}
                        </div>
                        <div className="col-md-5">
                          <label className="form-label" htmlFor={`participant-email-${index}`}>
                            Adresse e-mail
                          </label>
                          <input
                            id={`participant-email-${index}`}
                            name="email"
                            type="email"
                            value={participant.email}
                            onChange={(event) =>
                              handleParticipantFieldChange(index, 'email', event.target.value)
                            }
                            className={`form-control${
                              participantsErrors.items?.[index]?.email ? ' is-invalid' : ''
                            }`}
                            placeholder="alice@example.com"
                            disabled={participantsStatus.saving}
                          />
                          {participantsErrors.items?.[index]?.email && (
                            <div className="form-error">
                              {participantsErrors.items?.[index]?.email}
                            </div>
                          )}
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleRemoveParticipantRow(index)}
                            disabled={participantsStatus.saving}
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {participantsErrors.global && (
                  <div className="alert alert-warning mb-0" role="alert">
                    {participantsErrors.global}
                  </div>
                )}
                {participantsStatus.error && (
                  <div className="alert alert-danger mb-0" role="alert">
                    {participantsStatus.error}
                  </div>
                )}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleAddParticipantRow}
                    disabled={participantsStatus.saving}
                  >
                    Ajouter un participant
                  </button>
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleCancelEditParticipants}
                      disabled={participantsStatus.saving}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={participantsStatus.saving}
                    >
                      {participantsStatus.saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </form>
            ) : participants.length > 0 ? (
              <ul className="list-group mb-0">
                {participants.map((participant) => (
                  <li className="list-group-item" key={participant.email}>
                    {participant.name} — {participant.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mb-0">
                Aucun participant enregistré pour le moment.
              </p>
            )}
          </section>
          {eventId && (
            <section className="mb-4">
              <h2 className="fs-5 mb-3">Actions rapides</h2>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleTriggerDraw}
                  disabled={drawState.loading}
                >
                  {drawState.loading ? 'Tirage en cours…' : 'Lancer le tirage'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleViewNotifications}
                  disabled={notificationsState.loading}
                >
                  {notificationsState.loading
                    ? 'Chargement des envois…'
                    : 'Consulter les envois'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleShareEvent}
                  disabled={shareState.loading}
                >
                  {shareState.loading ? 'Partage en cours…' : 'Partager l’évènement'}
                </button>
              </div>
              {drawState.error && (
                <div className="alert alert-danger mt-3" role="alert">
                  {drawState.error}
                </div>
              )}
              {drawState.result && !drawState.error && (
                <div className="alert alert-success mt-3" role="status">
                  <p className="mb-2">
                    Tirage effectué pour
                    {' '}
                    {drawState.result.event?.name || currentEvent?.title || currentEvent?.name}.
                  </p>
                  {Array.isArray(drawState.result.status) && drawState.result.status.length > 0 ? (
                    <ul className="list-group">
                      {drawState.result.status.map((item, index) => (
                        <li
                          key={`${item.participantId || 'participant'}-${index}`}
                          className="list-group-item d-flex justify-content-between align-items-start gap-3"
                        >
                          <div className="flex-grow-1">
                            <span className="fw-semibold">
                              {resolveParticipantLabel(item.participantId)}
                            </span>
                          </div>
                          <div className="text-end">
                            <span
                              className={`badge ${
                                item.status === 'sent'
                                  ? 'bg-success'
                                  : item.status === 'failed'
                                    ? 'bg-danger'
                                    : 'bg-secondary'
                              }`}
                            >
                              {translateNotificationStatus(item.status)}
                            </span>
                            {item.error && (
                              <div className="small text-danger mt-1">{item.error}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-0">Aucune notification envoyée pour le moment.</p>
                  )}
                </div>
              )}
              {notificationsState.error && notificationsState.loaded && (
                <div className="alert alert-warning mt-3" role="alert">
                  {notificationsState.error}
                </div>
              )}
              {notificationsState.loading && (
                <p className="text-muted mt-3 mb-0">Chargement des notifications…</p>
              )}
              {hasNotifications && (
                <div className="mt-3">
                  <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 mb-2">
                    <h3 className="fs-6 mb-0">Historique des envois</h3>
                    <label className="d-flex align-items-center gap-2 mb-0">
                      <span className="text-muted small">Filtrer</span>
                      <select
                        className="form-select form-select-sm w-auto"
                        value={notificationsFilter}
                        onChange={(event) => setNotificationsFilter(event.target.value)}
                        disabled={notificationsState.loading}
                      >
                        <option value="all">Toutes</option>
                        <option value="unread">Non lues</option>
                        <option value="sent">Envoyées</option>
                        <option value="failed">Échecs</option>
                        <option value="pending">En attente</option>
                        <option value="read">Lues</option>
                      </select>
                    </label>
                  </div>
                  {filteredNotifications.length > 0 ? (
                    <ul className="list-group">
                      {filteredNotifications.map((notification) => {
                        const actionState =
                          notificationActions[notification.id] ||
                          defaultNotificationActionState;
                        const canMarkAsRead = notification.emailStatus !== 'read';
                        const canResend = Boolean(notification.assignedRecipientId);
                        return (
                          <li
                            key={notification.id}
                            className="list-group-item d-flex justify-content-between align-items-start gap-3"
                          >
                            <div className="flex-grow-1">
                              <div className="fw-semibold">{notification.name}</div>
                              <div className="text-muted small">{notification.email}</div>
                              {!notification.assignedRecipientId && (
                                <div className="text-muted small mt-1">
                                  Tirage non réalisé pour ce participant.
                                </div>
                              )}
                            </div>
                            <div className="text-end">
                              <span
                                className={`badge ${
                                  notification.emailStatus === 'sent'
                                    ? 'bg-success'
                                    : notification.emailStatus === 'failed'
                                      ? 'bg-danger'
                                      : notification.emailStatus === 'read'
                                        ? 'bg-primary'
                                        : 'bg-secondary'
                                }`}
                              >
                                {translateNotificationStatus(notification.emailStatus)}
                              </span>
                              {notification.emailSentAt && (
                                <div className="text-muted small mt-1">
                                  {formatDateTime(notification.emailSentAt)}
                                </div>
                              )}
                              {notification.emailError && (
                                <div className="text-danger small mt-1">
                                  {notification.emailError}
                                </div>
                              )}
                              <div className="d-flex flex-wrap justify-content-end gap-2 mt-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleMarkNotificationAsRead(notification.id)}
                                  disabled={
                                    !canMarkAsRead ||
                                    actionState.acknowledging ||
                                    notificationsState.loading
                                  }
                                >
                                  {actionState.acknowledging
                                    ? 'Marquage…'
                                    : 'Marquer comme lu'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleResendNotification(notification)}
                                  disabled={
                                    !canResend ||
                                    actionState.resending ||
                                    notificationsState.loading
                                  }
                                >
                                  {actionState.resending ? 'Renvoi…' : 'Relancer'}
                                </button>
                              </div>
                              {actionState.error && (
                                <div className="text-danger small mt-2">
                                  {actionState.error}
                                </div>
                              )}
                              {actionState.message && (
                                <div className="text-success small mt-2">
                                  {actionState.message}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted mb-0">
                      Aucune notification ne correspond au filtre sélectionné.
                    </p>
                  )}
                </div>
              )}
              {notificationsState.loaded &&
                !notificationsState.loading &&
                !notificationsState.error &&
                !hasNotifications && (
                  <p className="text-muted mt-3 mb-0">
                    Aucun email n’a encore été envoyé.
                  </p>
                )}
              {shareState.status && (
                <div className="alert alert-info mt-3" role="status">
                  {shareState.status}
                </div>
              )}
              {shareState.error && (
                <div className="alert alert-secondary mt-3" role="alert">
                  {shareState.error}
                </div>
              )}
            </section>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateAnotherEvent}
            >
              Créer un nouvel évènement
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBackHome}
            >
              Retourner à l’accueil
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EventDashboard;
