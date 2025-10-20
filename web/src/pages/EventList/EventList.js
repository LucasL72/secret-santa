import { useCallback, useEffect, useState } from 'react';
import {
  deleteEvent as deleteEventRequest,
  fetchEvents,
  fetchEventStatus,
  remindEventNotifications,
} from '../../services/api';

const translateNotificationStatus = (status) => {
  switch (status) {
    case 'sent':
      return 'Envoyé';
    case 'failed':
      return 'Échec';
    case 'pending':
    default:
      return 'En attente';
  }
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

const createActionState = () => ({
  showStatus: false,
  statusLoading: false,
  statusError: '',
  statusDetails: null,
  statusFetchedAt: null,
  remindLoading: false,
  remindError: '',
  remindMessage: '',
  deleteLoading: false,
  deleteError: '',
});

function EventList({
  authToken,
  onBackHome = () => {},
  onCreateEvent = () => {},
}) {
  const [eventsState, setEventsState] = useState({
    loading: false,
    error: '',
    items: [],
    loaded: false,
  });
  const [eventActions, setEventActions] = useState({});

  const updateActionState = useCallback((eventId, updater) => {
    setEventActions((previous) => {
      const current = previous[eventId] || createActionState();
      const updates =
        typeof updater === 'function'
          ? updater(current)
          : { ...current, ...updater };
      return {
        ...previous,
        [eventId]: { ...current, ...updates },
      };
    });
  }, []);

  const loadEvents = useCallback(async () => {
    if (!authToken) {
      setEventsState({
        loading: false,
        error: '',
        items: [],
        loaded: true,
      });
      return;
    }
    setEventsState((previous) => ({
      ...previous,
      loading: true,
      error: '',
      loaded: true,
    }));
    try {
      const response = await fetchEvents(authToken);
      const items = Array.isArray(response?.events) ? response.events : [];
      setEventsState({
        loading: false,
        error: '',
        items,
        loaded: true,
      });
    } catch (error) {
      setEventsState({
        loading: false,
        error: error?.message || 'Impossible de récupérer vos évènements.',
        items: [],
        loaded: true,
      });
    }
  }, [authToken]);

  const loadEventStatus = useCallback(
    async (eventId) => {
      if (!authToken) {
        updateActionState(eventId, (current) => ({
          ...current,
          showStatus: true,
          statusLoading: false,
          statusError: 'Authentification requise pour consulter le statut.',
        }));
        return;
      }
      updateActionState(eventId, (current) => ({
        ...current,
        showStatus: true,
        statusLoading: true,
        statusError: '',
      }));
      try {
        const response = await fetchEventStatus(eventId, authToken);
        updateActionState(eventId, (current) => ({
          ...current,
          statusLoading: false,
          statusError: '',
          statusDetails: Array.isArray(response?.participants)
            ? response.participants
            : [],
          statusFetchedAt: new Date().toISOString(),
        }));
      } catch (error) {
        updateActionState(eventId, (current) => ({
          ...current,
          statusLoading: false,
          statusError:
            error?.message || 'Impossible de récupérer le statut de cet évènement.',
        }));
      }
    },
    [authToken, updateActionState]
  );

  useEffect(() => {
    loadEvents();
    if (!authToken) {
      setEventActions({});
    }
  }, [authToken, loadEvents]);

  const handleToggleStatus = useCallback(
    async (eventId) => {
      const state = eventActions[eventId];
      if (state?.showStatus) {
        updateActionState(eventId, (current) => ({
          ...current,
          showStatus: false,
        }));
        return;
      }
      await loadEventStatus(eventId);
    },
    [eventActions, loadEventStatus, updateActionState]
  );

  const handleRefreshStatus = useCallback(
    async (eventId) => {
      await loadEventStatus(eventId);
    },
    [loadEventStatus]
  );

  const handleRemind = useCallback(
    async (eventId) => {
      if (!authToken) {
        return;
      }
      updateActionState(eventId, (current) => ({
        ...current,
        remindLoading: true,
        remindError: '',
        remindMessage: '',
      }));
      try {
        const response = await remindEventNotifications(eventId, authToken);
        const sent = Number(response?.results?.sent || 0);
        const total = Number(response?.results?.total || 0);
        const message = response?.message
          ? response.message
          : total > 0
            ? `Notifications renvoyées : ${sent} sur ${total}.`
            : 'Relance effectuée.';
        updateActionState(eventId, (current) => ({
          ...current,
          remindLoading: false,
          remindError: '',
          remindMessage: message,
        }));
        await loadEvents();
        if (eventActions[eventId]?.showStatus) {
          await loadEventStatus(eventId);
        }
      } catch (error) {
        updateActionState(eventId, (current) => ({
          ...current,
          remindLoading: false,
          remindError:
            error?.message || 'Impossible de relancer les notifications.',
        }));
      }
    },
    [authToken, eventActions, loadEventStatus, loadEvents, updateActionState]
  );

  const handleDelete = useCallback(
    async (eventId) => {
      if (!authToken) {
        return;
      }
      const confirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(
              'Êtes-vous sûr de vouloir supprimer cet évènement ? Cette action est définitive.'
            );
      if (!confirmed) {
        return;
      }
      updateActionState(eventId, (current) => ({
        ...current,
        deleteLoading: true,
        deleteError: '',
      }));
      try {
        await deleteEventRequest(eventId, authToken);
        setEventsState((previous) => ({
          ...previous,
          items: previous.items.filter((event) => event.id !== eventId),
        }));
        setEventActions((previous) => {
          const next = { ...previous };
          delete next[eventId];
          return next;
        });
      } catch (error) {
        updateActionState(eventId, (current) => ({
          ...current,
          deleteLoading: false,
          deleteError: error?.message || "Impossible de supprimer l'évènement.",
        }));
      }
    },
    [authToken, updateActionState]
  );

  if (!authToken) {
    return (
      <section className="container py-5">
        <div className="card shadow-lg">
          <div className="card-body text-center">
            <h1 className="fs-3 mb-3">Connexion requise</h1>
            <p className="text-muted mb-4">
              Connectez-vous pour visualiser, relancer ou supprimer vos évènements.
            </p>
            <button type="button" className="btn btn-primary" onClick={onBackHome}>
              Retour à l’accueil
            </button>
          </div>
        </div>
      </section>
    );
  }

  const { items, loading, error, loaded } = eventsState;

  return (
    <section className="event-list-view py-5">
      <div className="container">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
          <div>
            <h1 className="fs-3 mb-1">Mes évènements</h1>
            <p className="text-muted mb-0">
              Retrouvez vos tirages Secret Santa, consultez leur statut et relancez les participants.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={loadEvents}
              disabled={loading}
            >
              {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
            <button type="button" className="btn btn-primary" onClick={onCreateEvent}>
              Créer un nouvel évènement
            </button>
          </div>
        </div>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {loading && items.length === 0 ? (
          <p className="text-muted">Chargement de vos évènements…</p>
        ) : null}
        {!loading && loaded && items.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <h2 className="fs-4 mb-2">Aucun évènement pour le moment</h2>
              <p className="text-muted mb-4">
                Lancez un nouvel échange pour voir apparaître ici vos Secret Santa.
              </p>
              <div className="d-flex justify-content-center gap-2">
                <button type="button" className="btn btn-primary" onClick={onCreateEvent}>
                  Créer un évènement
                </button>
                <button type="button" className="btn btn-ghost" onClick={onBackHome}>
                  Retour à l’accueil
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="d-flex flex-column gap-3">
          {items.map((event) => {
            const actionState = eventActions[event.id] || createActionState();
            const totalParticipants = Number(event?.participants?.total || 0);
            const sentCount = Number(event?.participants?.sent || 0);
            const failedCount = Number(event?.participants?.failed || 0);
            const pendingCount = Number(event?.participants?.pending || 0);
            return (
              <article key={event.id} className="card shadow-sm" aria-live="polite">
                <div className="card-body">
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                      <h2 className="fs-4 mb-1">{event.name}</h2>
                      <p className="text-muted mb-2">
                        Créé le {formatDate(event.createdAt) || 'date inconnue'}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge bg-secondary">
                          {totalParticipants} participant{totalParticipants > 1 ? 's' : ''}
                        </span>
                        <span className="badge bg-success">
                          {sentCount} envoyé{sentCount > 1 ? 's' : ''}
                        </span>
                        <span className="badge bg-warning text-dark">
                          {pendingCount} en attente
                        </span>
                        <span className="badge bg-danger">
                          {failedCount} en échec
                        </span>
                        {event.eventDate && (
                          <span className="badge bg-info text-dark">
                            Échange prévu le {formatDate(event.eventDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="d-flex flex-column gap-2 align-items-md-end">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() => handleToggleStatus(event.id)}
                        disabled={actionState.statusLoading}
                      >
                        {actionState.showStatus
                          ? 'Masquer le statut'
                          : actionState.statusLoading
                            ? 'Chargement…'
                            : 'Consulter le statut'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-success"
                        onClick={() => handleRemind(event.id)}
                        disabled={actionState.remindLoading}
                      >
                        {actionState.remindLoading
                          ? 'Relance en cours…'
                          : 'Relancer les mails'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => handleDelete(event.id)}
                        disabled={actionState.deleteLoading}
                      >
                        {actionState.deleteLoading ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                  {actionState.remindError && (
                    <div className="alert alert-danger mt-3" role="alert">
                      {actionState.remindError}
                    </div>
                  )}
                  {actionState.remindMessage && (
                    <div className="alert alert-success mt-3" role="status">
                      {actionState.remindMessage}
                    </div>
                  )}
                  {actionState.deleteError && (
                    <div className="alert alert-danger mt-3" role="alert">
                      {actionState.deleteError}
                    </div>
                  )}
                  {actionState.showStatus && (
                    <div className="mt-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h3 className="fs-5 mb-0">Suivi des notifications</h3>
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => handleRefreshStatus(event.id)}
                          disabled={actionState.statusLoading}
                        >
                          {actionState.statusLoading ? 'Actualisation…' : 'Actualiser'}
                        </button>
                      </div>
                      {actionState.statusError && (
                        <div className="alert alert-warning" role="alert">
                          {actionState.statusError}
                        </div>
                      )}
                      {actionState.statusLoading ? (
                        <p className="text-muted mb-0">Chargement des notifications…</p>
                      ) : null}
                      {!actionState.statusLoading &&
                      actionState.statusDetails &&
                      actionState.statusDetails.length === 0 ? (
                        <p className="text-muted mb-0">
                          Aucun participant ou aucune notification à afficher.
                        </p>
                      ) : null}
                      {!actionState.statusLoading &&
                      Array.isArray(actionState.statusDetails) &&
                      actionState.statusDetails.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table align-middle mb-0">
                            <thead>
                              <tr>
                                <th scope="col">Participant</th>
                                <th scope="col">Email</th>
                                <th scope="col">Statut</th>
                                <th scope="col">Dernier envoi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {actionState.statusDetails.map((participant) => (
                                <tr key={participant.id}>
                                  <td>{participant.name}</td>
                                  <td className="text-muted">{participant.email}</td>
                                  <td>
                                    <span
                                      className={`badge ${
                                        participant.emailStatus === 'sent'
                                          ? 'bg-success'
                                          : participant.emailStatus === 'failed'
                                            ? 'bg-danger'
                                            : 'bg-secondary'
                                      }`}
                                    >
                                      {translateNotificationStatus(
                                        participant.emailStatus
                                      )}
                                    </span>
                                    {participant.emailError && (
                                      <div className="small text-danger mt-1">
                                        {participant.emailError}
                                      </div>
                                    )}
                                  </td>
                                  <td className="text-muted">
                                    {formatDateTime(participant.emailSentAt) || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      {actionState.statusFetchedAt && (
                        <p className="text-muted small mt-3 mb-0">
                          Dernière actualisation : {formatDateTime(actionState.statusFetchedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default EventList;
