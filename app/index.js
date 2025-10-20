require('dotenv').config();

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// ---- Configuration -------------------------------------------------------
function parseInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

const PORT = parseInteger(process.env.PORT, 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const EMAIL_SENDER = process.env.MAIL_SENDER || 'secret-santa@example.com';
const EMAIL_SUBJECT = process.env.MAIL_SUBJECT || 'Votre tirage Secret Santa';
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = parseInteger(process.env.MYSQL_PORT, 3306);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'secret_santa';
const MYSQL_CONNECTION_LIMIT = parseInteger(process.env.MYSQL_CONNECTION_LIMIT, 10);

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: MYSQL_CONNECTION_LIMIT,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
});

// ---- Utility helpers -----------------------------------------------------
function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4 !== 0) {
    input += '=';
  }
  return Buffer.from(input, 'base64').toString();
}

function signJwt(payload, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = options.expiresInSeconds || 60 * 60 * 24; // default 24h
  const tokenPayload = { ...payload, iat: now, exp: now + expSeconds };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function verifyJwt(token) {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [headerB64, payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const hashed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const compareBuffer = Buffer.from(hashed, 'hex');
  if (hashBuffer.length !== compareBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(hashBuffer, compareBuffer);
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function respondJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendBadRequest(res, message, details) {
  respondJson(res, 400, { error: message, details });
}

function sendUnauthorized(res, message = 'Unauthorized') {
  respondJson(res, 401, { error: message });
}

function sendNotFound(res, message = 'Not found') {
  respondJson(res, 404, { error: message });
}

function sendServerError(res, error) {
  console.error('[Server Error]', error);
  respondJson(res, 500, { error: 'Internal server error' });
}

// ---- MySQL helpers -------------------------------------------------------
function formatDateTime(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function nowDateTime() {
  return formatDateTime(new Date());
}

function toIsoString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const withTimezone = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
    const date = new Date(withTimezone);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return value;
}

function normalizeEventRow(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    eventDate: toIsoString(row.eventDate),
    createdAt: toIsoString(row.createdAt),
  };
}

function normalizeParticipantRow(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    emailSentAt: toIsoString(row.emailSentAt),
    createdAt: toIsoString(row.createdAt),
  };
}

async function runSql(sql, params = [], { expectRows = false } = {}) {
  const trimmedSql = sql.trim();
  const normalizedSql = trimmedSql.endsWith(';')
    ? trimmedSql.slice(0, trimmedSql.length - 1)
    : trimmedSql;
  const queryParams = Array.isArray(params) ? params : [];
  try {
    const [rows] = await pool.execute(normalizedSql, queryParams);
    if (expectRows) {
      return Array.isArray(rows) ? rows : [];
    }
    return rows;
  } catch (error) {
    console.error('[Database] Error executing query:', error);
    throw error;
  }
}

async function executeSql(sql, params = []) {
  return runSql(sql, params, { expectRows: false });
}

async function querySql(sql, params = []) {
  return runSql(sql, params, { expectRows: true });
}

async function initializeDatabase() {
  await executeSql(
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      event_date DATETIME NULL,
      budget DECIMAL(10, 2) NULL,
      location VARCHAR(255) NULL,
      draw_generated TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_events_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS participants (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      assigned_recipient_id INT UNSIGNED NULL,
      email_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      email_error TEXT NULL,
      email_sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_participant_email (event_id, email),
      CONSTRAINT fk_participants_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      CONSTRAINT fk_participants_recipient FOREIGN KEY (assigned_recipient_id) REFERENCES participants(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

// ---- Email sending -------------------------------------------------------
async function sendEmail(to, subject, body) {
  // In a real application you would configure Nodemailer here. Because the
  // execution environment for this kata does not allow installing npm
  // dependencies, we log the emails to the console instead.
  console.log(
    `\n--- Email envoyé ---\nDe: ${EMAIL_SENDER}\nA: ${to}\nSujet: ${subject}\n${body}\n--------------------\n`
  );
  return { accepted: [to], rejected: [] };
}

// ---- Simple Express-like framework --------------------------------------
function createApp() {
  const middlewares = [];
  const routes = [];

  function use(fn) {
    middlewares.push(fn);
  }

  function addRoute(method, routePath, handlers) {
    if (!Array.isArray(handlers) || handlers.length === 0) {
      throw new Error('Chaque route doit avoir au moins un gestionnaire');
    }
    const { matcher, keys } = compileRoute(routePath);
    routes.push({ method, handlers, matcher, keys });
  }

  async function runHandlers(req, res, handlers) {
    let index = 0;
    const runNext = async () => {
      if (res.writableEnded || index >= handlers.length) {
        return;
      }
      const handler = handlers[index++];
      if (handler.length >= 3) {
        await new Promise((resolve, reject) => {
          const next = (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          };
          try {
            handler(req, res, next);
          } catch (error) {
            reject(error);
          }
        });
        await runNext();
      } else {
        const result = handler(req, res);
        if (result && typeof result.then === 'function') {
          await result;
        }
        if (!res.writableEnded) {
          await runNext();
        }
      }
    };
    await runNext();
  }

  async function handleRequest(req, res) {
    try {
      const parsedUrl = url.parse(req.url, true);
      req.path = parsedUrl.pathname;
      req.query = parsedUrl.query || {};
      req.params = {};
      req.body = undefined;

      res.status = (code) => {
        res.statusCode = code;
        return res;
      };

      res.json = (payload) => {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(payload));
      };

      res.send = (payload) => {
        res.end(payload);
      };

      await runHandlers(req, res, middlewares);
      if (res.writableEnded) {
        return;
      }

      const route = routes.find((r) => r.method === req.method && r.matcher.test(req.path));
      if (!route) {
        return sendNotFound(res);
      }

      const match = route.matcher.exec(req.path);
      if (match) {
        route.keys.forEach((key, idx) => {
          req.params[key] = decodeURIComponent(match[idx + 1]);
        });
      }

      await runHandlers(req, res, route.handlers);
    } catch (error) {
      sendServerError(res, error);
    }
  }

  function listen(port, cb) {
    const server = http.createServer(handleRequest);
    server.listen(port, cb);
    return server;
  }

  return {
    use,
    listen,
    get: (routePath, ...handlers) => addRoute('GET', routePath, handlers),
    post: (routePath, ...handlers) => addRoute('POST', routePath, handlers),
    delete: (routePath, ...handlers) => addRoute('DELETE', routePath, handlers),
  };
}

function compileRoute(routePath) {
  const keys = [];
  const pattern = routePath
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const matcher = new RegExp(`^${pattern}$`);
  return { matcher, keys };
}

// ---- JSON body parser ----------------------------------------------------
function jsonBodyParser(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    req.body = {};
    return next();
  }

  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1e6) {
      data = '';
      res.statusCode = 413;
      res.end('Payload too large');
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    if (!data) {
      req.body = {};
      return next();
    }
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      return sendBadRequest(res, 'Invalid JSON payload');
    }
    next();
  });
}

// ---- Authentication middleware ------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!token) {
    return sendUnauthorized(res);
  }
  const payload = verifyJwt(token);
  if (!payload) {
    return sendUnauthorized(res, 'Invalid or expired token');
  }
  req.user = payload;
  next();
}

// ---- Business logic ------------------------------------------------------
async function registerUser(req, res) {
  const email = sanitizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return sendBadRequest(res, 'Adresse email invalide');
  }
  if (!password || password.length < 8) {
    return sendBadRequest(res, 'Le mot de passe doit contenir au moins 8 caractères');
  }

  const existing = await querySql('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return sendBadRequest(res, 'Un compte existe déjà pour cette adresse email');
  }

  const { salt, hash } = hashPassword(password);
  const createdAt = nowDateTime();
  const insertResult = await executeSql(
    `INSERT INTO users (email, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?)`,
    [email, hash, salt, createdAt]
  );
  const userId = insertResult.insertId;
  const token = signJwt({ userId, email });
  respondJson(res, 201, {
    token,
    user: { id: userId, email },
  });
}

async function loginUser(req, res) {
  const email = sanitizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return sendBadRequest(res, 'Identifiants manquants');
  }

  const users = await querySql(
    'SELECT id, password_hash as passwordHash, password_salt as passwordSalt FROM users WHERE email = ?',
    [email]
  );
  if (users.length === 0) {
    return sendUnauthorized(res, 'Email ou mot de passe invalide');
  }
  const user = users[0];
  const valid = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    return sendUnauthorized(res, 'Email ou mot de passe invalide');
  }
  const token = signJwt({ userId: user.id, email });
  respondJson(res, 200, { token, user: { id: user.id, email } });
}

function validateParticipants(participants) {
  if (!Array.isArray(participants) || participants.length < 2) {
    return {
      valid: false,
      error: 'Ajoutez au moins deux participants pour organiser un tirage.',
      fieldErrors: { participants: 'Ajoutez au moins deux participants pour organiser un tirage.' },
    };
  }
  const normalized = [];
  const emails = new Set();
  for (const participant of participants) {
    const name = String(participant.name || '').trim();
    const email = sanitizeEmail(participant.email);
    if (!name) {
      return {
        valid: false,
        error: 'Chaque participant doit avoir un nom.',
        fieldErrors: { participants: 'Chaque participant doit avoir un nom.' },
      };
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return {
        valid: false,
        error: `Adresse email invalide pour ${name || 'participant'}.`,
        fieldErrors: {
          participants: `Adresse email invalide pour ${name || 'participant'}.`,
        },
      };
    }
    if (emails.has(email)) {
      return {
        valid: false,
        error: `Adresse email en double détectée: ${email}.`,
        fieldErrors: { participants: `Adresse email en double détectée: ${email}.` },
      };
    }
    emails.add(email);
    normalized.push({ name, email });
  }
  return { valid: true, participants: normalized };
}

async function createEvent(req, res) {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim() || null;
  const rawBudget = String(req.body.budget ?? '').trim();
  const location = String(req.body.location || '').trim();
  let eventDate = null;
  if (req.body.eventDate) {
    const parsedDate = new Date(req.body.eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return sendBadRequest(res, "Date de l'évènement invalide", {
        fieldErrors: { deadline: "Date de l'évènement invalide" },
        step: 'details',
      });
    }
    eventDate = formatDateTime(parsedDate);
  }
  const validation = validateParticipants(req.body.participants);

  if (!name) {
    return sendBadRequest(res, "Le nom de l'évènement est obligatoire", {
      fieldErrors: { title: "Le nom de l'évènement est obligatoire" },
      step: 'details',
    });
  }
  if (!rawBudget) {
    return sendBadRequest(res, 'Le budget maximum est obligatoire.', {
      fieldErrors: { budget: 'Le budget maximum est obligatoire.' },
      step: 'details',
    });
  }
  const budget = Number(rawBudget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return sendBadRequest(res, 'Le budget doit être un montant positif.', {
      fieldErrors: { budget: 'Le budget doit être un montant positif.' },
      step: 'details',
    });
  }
  if (!location) {
    return sendBadRequest(res, 'Le lieu de l’évènement est obligatoire.', {
      fieldErrors: { location: 'Le lieu de l’évènement est obligatoire.' },
      step: 'details',
    });
  }
  if (!validation.valid) {
    return sendBadRequest(res, validation.error, {
      fieldErrors: validation.fieldErrors || { participants: validation.error },
      step: 'participants',
    });
  }

  const createdAt = nowDateTime();
  const eventInsert = await executeSql(
    `INSERT INTO events (owner_id, name, description, event_date, budget, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.userId, name, description, eventDate, budget, location, createdAt]
  );
  const eventId = eventInsert.insertId;

  for (const participant of validation.participants) {
    await executeSql(
      `INSERT INTO participants (event_id, name, email, created_at)
       VALUES (?, ?, ?, ?)` ,
      [eventId, participant.name, participant.email, createdAt]
    );
  }

  respondJson(res, 201, {
    event: {
      id: eventId,
      name,
      description,
      eventDate: toIsoString(eventDate),
      budget,
      location,
      createdAt: toIsoString(createdAt),
      participants: validation.participants,
    },
  });
}

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAssignments(participants) {
  const shuffled = shuffleArray(participants);
  const assignments = [];
  for (let i = 0; i < shuffled.length; i += 1) {
    const giver = shuffled[i];
    const receiver = shuffled[(i + 1) % shuffled.length];
    assignments.push({ giver, receiver });
  }
  return assignments;
}

async function triggerDraw(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const events = await querySql(
    'SELECT id, owner_id as ownerId, name FROM events WHERE id = ?',
    [eventId]
  );
  if (events.length === 0 || events[0].ownerId !== req.user.userId) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const event = events[0];

  const participants = (
    await querySql(
      `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
              email_sent_at as emailSentAt, created_at as createdAt,
              assigned_recipient_id as assignedRecipientId
       FROM participants WHERE event_id = ?`,
      [eventId]
    )
  ).map(normalizeParticipantRow);
  if (participants.length < 2) {
    return sendBadRequest(res, 'Ajoutez au moins deux participants avant de lancer le tirage');
  }

  const assignments = buildAssignments(participants);
  const now = nowDateTime();
  const summary = [];

  for (const pair of assignments) {
    const message = `Bonjour ${pair.giver.name},\n\nVous offrirez un cadeau à ${pair.receiver.name} (${pair.receiver.email}).\nBonne préparation !`;
    try {
      await sendEmail(pair.giver.email, EMAIL_SUBJECT, message);
      await executeSql(
        `UPDATE participants
         SET assigned_recipient_id = ?, email_status = 'sent', email_error = NULL, email_sent_at = ?
         WHERE id = ?`,
        [pair.receiver.id, now, pair.giver.id]
      );
      summary.push({ participantId: pair.giver.id, status: 'sent' });
    } catch (error) {
      await executeSql(
        `UPDATE participants
         SET assigned_recipient_id = ?, email_status = 'failed', email_error = ?, email_sent_at = ?
         WHERE id = ?`,
        [pair.receiver.id, String(error), now, pair.giver.id]
      );
      summary.push({ participantId: pair.giver.id, status: 'failed', error: String(error) });
    }
  }

  await executeSql('UPDATE events SET draw_generated = 1 WHERE id = ?', [eventId]);

  respondJson(res, 200, {
    event: { id: event.id, name: event.name },
    status: summary,
  });
}

async function getEventStatus(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const events = await querySql(
    `SELECT id, owner_id as ownerId, name, description, event_date as eventDate,
            budget, location, draw_generated as drawGenerated, created_at as createdAt
     FROM events WHERE id = ?`,
    [eventId]
  );
  if (events.length === 0 || events[0].ownerId !== req.user.userId) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const event = normalizeEventRow(events[0]);
  const participants = (
    await querySql(
      `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
              email_sent_at as emailSentAt, created_at as createdAt,
              assigned_recipient_id as assignedRecipientId
       FROM participants WHERE event_id = ?`,
      [eventId]
    )
  ).map(normalizeParticipantRow);
  respondJson(res, 200, { event, participants });
}

async function getEventForOwner(eventId, ownerId) {
  if (!eventId) {
    return null;
  }
  const events = await querySql(
    `SELECT id, owner_id as ownerId, name, description, event_date as eventDate,
            budget, location, draw_generated as drawGenerated, created_at as createdAt
     FROM events WHERE id = ?`,
    [eventId]
  );
  if (events.length === 0) {
    return null;
  }
  const event = events[0];
  if (event.ownerId !== ownerId) {
    return null;
  }
  return normalizeEventRow(event);
}

async function getParticipantForEventById(eventId, participantId) {
  if (!participantId) {
    return null;
  }
  const participants = await querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, created_at as createdAt,
            assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = ? AND id = ?`,
    [eventId, participantId]
  );
  return normalizeParticipantRow(participants[0]) || null;
}

async function getParticipantForEventByEmail(eventId, participantEmail) {
  const email = sanitizeEmail(participantEmail);
  if (!email) {
    return null;
  }
  const participants = await querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, created_at as createdAt,
            assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = ? AND email = ?`,
    [eventId, email]
  );
  return normalizeParticipantRow(participants[0]) || null;
}

async function listEventNotifications(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const event = await getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const notifications = (
    await querySql(
      `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
              email_sent_at as emailSentAt, created_at as createdAt,
              assigned_recipient_id as assignedRecipientId
       FROM participants WHERE event_id = ?
       ORDER BY created_at ASC`,
      [eventId]
    )
  ).map(normalizeParticipantRow);
  respondJson(res, 200, { event: { id: event.id, name: event.name }, notifications });
}

async function acknowledgeNotification(req, res) {
  const eventId = Number(req.params.id);
  const participantId = Number(req.params.notificationId);
  if (!eventId || !participantId) {
    return sendBadRequest(res, 'Identifiants de notification invalides');
  }
  const event = await getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const participant = await getParticipantForEventById(eventId, participantId);
  if (!participant) {
    return sendNotFound(res, 'Notification introuvable');
  }
  const status = String(req.body.status || '').trim();
  if (!status) {
    return sendBadRequest(res, 'Statut de notification manquant');
  }
  await executeSql(
    `UPDATE participants SET email_status = ? WHERE id = ? AND event_id = ?`,
    [status, participantId, eventId]
  );
  respondJson(res, 200, {
    notification: {
      id: participantId,
      status,
      email: participant.email,
      name: participant.name,
    },
  });
}

async function resendNotification(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const event = await getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const participantEmail = sanitizeEmail(req.body.participantEmail);
  if (!participantEmail) {
    return sendBadRequest(res, 'Adresse email du participant manquante');
  }
  const participant = await getParticipantForEventByEmail(eventId, participantEmail);
  if (!participant) {
    return sendNotFound(res, 'Participant introuvable');
  }
  if (!participant.assignedRecipientId) {
    return sendBadRequest(
      res,
      "Ce participant n'a pas encore reçu d'assignation de cadeau"
    );
  }
  const recipientRows = await querySql(
    `SELECT id, name, email FROM participants WHERE id = ?`,
    [participant.assignedRecipientId]
  );
  if (recipientRows.length === 0) {
    return sendNotFound(res, 'Assignation de cadeau introuvable');
  }
  const recipient = recipientRows[0];
  const message = `Bonjour ${participant.name},\n\nVous offrirez un cadeau à ${recipient.name} (${recipient.email}).\nBonne préparation !`;
  const now = nowDateTime();
  try {
    await sendEmail(participant.email, EMAIL_SUBJECT, message);
    await executeSql(
      `UPDATE participants
       SET email_status = 'sent', email_error = NULL, email_sent_at = ?
       WHERE id = ? AND event_id = ?`,
      [now, participant.id, eventId]
    );
    respondJson(res, 200, {
      notification: {
        id: participant.id,
        status: 'sent',
        email: participant.email,
        name: participant.name,
        sentAt: toIsoString(now),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await executeSql(
      `UPDATE participants
       SET email_status = 'failed', email_error = ?, email_sent_at = ?
       WHERE id = ? AND event_id = ?`,
      [errorMessage, now, participant.id, eventId]
    );
    respondJson(res, 500, {
      error: "L'envoi du message a échoué",
      details: errorMessage,
    });
  }
}

async function listEvents(req, res) {
  const events = await querySql(
    `SELECT
       e.id,
       e.owner_id as ownerId,
       e.name,
       e.description,
       e.event_date as eventDate,
       e.budget,
       e.location,
       e.draw_generated as drawGenerated,
       e.created_at as createdAt,
       COUNT(p.id) as participantCount,
       SUM(CASE WHEN p.email_status = 'sent' THEN 1 ELSE 0 END) as sentCount,
       SUM(CASE WHEN p.email_status = 'failed' THEN 1 ELSE 0 END) as failedCount,
       SUM(CASE WHEN p.email_status = 'pending' THEN 1 ELSE 0 END) as pendingCount
     FROM events e
     LEFT JOIN participants p ON p.event_id = e.id
     WHERE e.owner_id = ?
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
    [req.user.userId]
  );

  const normalizedEvents = events
    .filter((event) => event.ownerId === req.user.userId)
    .map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      eventDate: toIsoString(event.eventDate),
      budget: event.budget,
      location: event.location,
      drawGenerated: Boolean(event.drawGenerated),
      createdAt: toIsoString(event.createdAt),
      participants: {
        total: Number(event.participantCount || 0),
        sent: Number(event.sentCount || 0),
        failed: Number(event.failedCount || 0),
        pending: Number(event.pendingCount || 0),
      },
    }));

  respondJson(res, 200, { events: normalizedEvents });
}

async function deleteEvent(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const event = await getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  await executeSql('DELETE FROM events WHERE id = ?', [eventId]);
  res.statusCode = 204;
  res.end();
}

async function remindEventNotifications(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const event = await getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  if (!event.drawGenerated) {
    return sendBadRequest(
      res,
      "Le tirage n'a pas encore été effectué pour cet évènement."
    );
  }

  const participants = (
    await querySql(
      `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
              email_sent_at as emailSentAt, created_at as createdAt,
              assigned_recipient_id as assignedRecipientId
       FROM participants
       WHERE event_id = ?
       ORDER BY created_at ASC`,
      [eventId]
    )
  ).map(normalizeParticipantRow);

  if (participants.length === 0) {
    return sendBadRequest(
      res,
      "Aucun participant n'est enregistré pour cet évènement."
    );
  }

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant])
  );

  const targets = participants.filter(
    (participant) =>
      participant.assignedRecipientId && participant.emailStatus !== 'sent'
  );

  if (targets.length === 0) {
    return respondJson(res, 200, {
      event: { id: event.id, name: event.name },
      results: { total: 0, sent: 0, failed: 0 },
      message: 'Tous les participants ont déjà reçu leur notification.',
    });
  }

  let sentCount = 0;
  let failedCount = 0;
  const details = [];

  for (const participant of targets) {
    const recipient = participantsById.get(participant.assignedRecipientId);
    if (!recipient) {
      failedCount += 1;
      details.push({
        participantId: participant.id,
        status: 'failed',
        error: 'Destinataire introuvable pour ce participant.',
      });
      continue;
    }

    const message = `Bonjour ${participant.name},\n\nVous offrirez un cadeau à ${recipient.name} (${recipient.email}).\nBonne préparation !`;
    const sentAt = nowDateTime();
    try {
      await sendEmail(participant.email, EMAIL_SUBJECT, message);
      await executeSql(
        `UPDATE participants
         SET email_status = 'sent', email_error = NULL, email_sent_at = ?
         WHERE id = ? AND event_id = ?`,
        [sentAt, participant.id, eventId]
      );
      sentCount += 1;
      details.push({
        participantId: participant.id,
        status: 'sent',
        sentAt: toIsoString(sentAt),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await executeSql(
        `UPDATE participants
         SET email_status = 'failed', email_error = ?, email_sent_at = ?
         WHERE id = ? AND event_id = ?`,
        [errorMessage, sentAt, participant.id, eventId]
      );
      failedCount += 1;
      details.push({
        participantId: participant.id,
        status: 'failed',
        error: errorMessage,
        sentAt: toIsoString(sentAt),
      });
    }
  }

  respondJson(res, 200, {
    event: { id: event.id, name: event.name },
    results: { total: targets.length, sent: sentCount, failed: failedCount },
    details,
  });
}

// ---- Application bootstrap ----------------------------------------------
const app = createApp();
app.use(jsonBodyParser);

app.post('/api/auth/register', (req, res) => registerUser(req, res));
app.post('/api/auth/login', (req, res) => loginUser(req, res));
app.post('/api/events', authMiddleware, (req, res) => createEvent(req, res));
app.get('/api/events', authMiddleware, (req, res) => listEvents(req, res));
app.post('/api/events/:id/draw', authMiddleware, (req, res) => triggerDraw(req, res));
app.get('/api/events/:id/status', authMiddleware, (req, res) => getEventStatus(req, res));
app.get('/api/events/:id/notifications', authMiddleware, (req, res) =>
  listEventNotifications(req, res)
);
app.patch(
  '/api/events/:id/notifications/:notificationId',
  authMiddleware,
  (req, res) => acknowledgeNotification(req, res)
);
app.post('/api/events/:id/notifications/resend', authMiddleware, (req, res) =>
  resendNotification(req, res)
);
app.post(
  '/api/events/:id/notifications/remind',
  authMiddleware,
  (req, res) => remindEventNotifications(req, res)
);
app.delete('/api/events/:id', authMiddleware, (req, res) => deleteEvent(req, res));

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Secret Santa API disponible sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Startup] Database initialization failed:', error);
    process.exit(1);
  }
}

startServer();
