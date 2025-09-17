const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

export const AUTH_TOKEN_STORAGE_KEY = 'ssfl-auth-token';

let storedAuthToken = null;

export function setAuthToken(token) {
  storedAuthToken = token || null;
}

export function getAuthToken() {
  return storedAuthToken;
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const { authToken: explicitToken, headers: customHeaders = {}, ...restOptions } = options;
  const token = explicitToken ?? storedAuthToken ?? null;
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...restOptions,
    headers,
  };

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (
    config.body &&
    typeof config.body === 'object' &&
    !(config.body instanceof FormData)
  ) {
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

export async function createEvent(eventData, token) {
  return request('/events', {
    method: 'POST',
    body: eventData,
    authToken: token,
  });
}

export async function fetchNotifications(eventId, token) {
  return request(`/events/${eventId}/notifications`, {
    method: 'GET',
    authToken: token,
  });
}

export async function acknowledgeNotification(eventId, notificationId, token) {
  return request(`/events/${eventId}/notifications/${notificationId}`, {
    method: 'PATCH',
    body: { status: 'read' },
    authToken: token,
  });
}

export async function resendNotification(eventId, participantEmail, token) {
  return request(`/events/${eventId}/notifications/resend`, {
    method: 'POST',
    body: { participantEmail },
    authToken: token,
  });
}
