const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && data.message) ||
      (typeof data === 'string' && data) ||
      'Une erreur est survenue lors de la communication avec le serveur.';
    throw new Error(message);
  }

  return data;
}

export async function registerCreator({ fullName, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: { fullName, email, password },
  });
}

export async function loginCreator({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function createEvent(eventData) {
  return request('/events', {
    method: 'POST',
    body: eventData,
  });
}

export async function fetchNotifications(eventId) {
  return request(`/events/${eventId}/notifications`, {
    method: 'GET',
  });
}

export async function acknowledgeNotification(eventId, notificationId) {
  return request(`/events/${eventId}/notifications/${notificationId}`, {
    method: 'PATCH',
    body: { status: 'read' },
  });
}

export async function resendNotification(eventId, participantEmail) {
  return request(`/events/${eventId}/notifications/resend`, {
    method: 'POST',
    body: { participantEmail },
  });
}
