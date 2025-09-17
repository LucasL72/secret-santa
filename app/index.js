const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ---- Configuration -------------------------------------------------------
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'secret-santa.sqlite');
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const EMAIL_SENDER = process.env.MAIL_SENDER || 'secret-santa@example.com';
const EMAIL_SUBJECT = process.env.MAIL_SUBJECT || 'Votre tirage Secret Santa';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

// ---- SQLite wrapper ------------------------------------------------------
function formatSqlParameter(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

function runSql(sql, params = [], { expectRows = false } = {}) {
  const statements = ['.mode json', '.parameter init'];
  params.forEach((value, index) => {
    statements.push(`.parameter set @p${index} ${formatSqlParameter(value)}`);
  });
  statements.push(sql.trim().endsWith(';') ? sql.trim() : `${sql.trim()};`);
  const command = statements.join('\n');
  const result = spawnSync('sqlite3', [DB_FILE], {
    input: `${command}\n`,
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || 'SQLite error';
    throw new Error(message.trim());
  }
  if (!expectRows) {
    return [];
  }
  const output = (result.stdout || '').trim();
  if (!output) {
    return [];
  }
  const lines = output.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const jsonString = lines.join('');
  if (!jsonString) {
    return [];
  }
  return JSON.parse(jsonString);
}

function executeSql(sql, params = []) {
  return runSql(sql, params, { expectRows: false });
}

function querySql(sql, params = []) {
  return runSql(sql, params, { expectRows: true });
}

function ensureColumnExists(tableName, columnName, columnDefinition) {
  try {
    const columns = querySql(`PRAGMA table_info(${tableName})`);
    const hasColumn = columns.some((column) => column.name === columnName);
    if (!hasColumn) {
      executeSql(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
  } catch (error) {
    console.error(`[Database] Unable to ensure column ${columnName} on ${tableName}:`, error);
    throw error;
  }
}

function initializeDatabase() {
  executeSql(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  executeSql(
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      event_date TEXT,
      budget REAL,
      location TEXT,
      draw_generated INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    )`
  );

  ensureColumnExists('events', 'budget', 'REAL');
  ensureColumnExists('events', 'location', 'TEXT');

  executeSql(
    `CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      assigned_recipient_id INTEGER,
      email_status TEXT DEFAULT 'pending',
      email_error TEXT,
      email_sent_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, email),
      FOREIGN KEY(event_id) REFERENCES events(id),
      FOREIGN KEY(assigned_recipient_id) REFERENCES participants(id)
    )`
  );
}

initializeDatabase();

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

  const existing = querySql('SELECT id FROM users WHERE email = @p0', [email]);
  if (existing.length > 0) {
    return sendBadRequest(res, 'Un compte existe déjà pour cette adresse email');
  }

  const { salt, hash } = hashPassword(password);
  const createdAt = new Date().toISOString();
  const insertResult = querySql(
    `INSERT INTO users (email, password_hash, password_salt, created_at)
     VALUES (@p0, @p1, @p2, @p3)
     RETURNING id`,
    [email, hash, salt, createdAt]
  );
  const userId = insertResult[0]?.id;
  const token = signJwt({ userId, email });
  respondJson(res, 201, { token, user: { id: userId, email } });
}

async function loginUser(req, res) {
  const email = sanitizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return sendBadRequest(res, 'Identifiants manquants');
  }

  const users = querySql(
    'SELECT id, password_hash as passwordHash, password_salt as passwordSalt FROM users WHERE email = @p0',
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
    return { valid: false, error: 'Ajoutez au moins deux participants pour organiser un tirage.' };
  }
  const normalized = [];
  const emails = new Set();
  for (const participant of participants) {
    const name = String(participant.name || '').trim();
    const email = sanitizeEmail(participant.email);
    if (!name) {
      return { valid: false, error: 'Chaque participant doit avoir un nom.' };
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { valid: false, error: `Adresse email invalide pour ${name || 'participant'}.` };
    }
    if (emails.has(email)) {
      return { valid: false, error: `Adresse email en double détectée: ${email}.` };
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
      return sendBadRequest(res, 'Date de l\'évènement invalide');
    }
    eventDate = parsedDate.toISOString();
  }
  const validation = validateParticipants(req.body.participants);

  if (!name) {
    return sendBadRequest(res, "Le nom de l'évènement est obligatoire");
  }
  if (!rawBudget) {
    return sendBadRequest(res, 'Le budget maximum est obligatoire.');
  }
  const budget = Number(rawBudget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return sendBadRequest(res, 'Le budget doit être un montant positif.');
  }
  if (!location) {
    return sendBadRequest(res, 'Le lieu de l’évènement est obligatoire.');
  }
  if (!validation.valid) {
    return sendBadRequest(res, validation.error);
  }

  const createdAt = new Date().toISOString();
  const eventInsert = querySql(
    `INSERT INTO events (owner_id, name, description, event_date, budget, location, created_at)
     VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6)
     RETURNING id`,
    [req.user.userId, name, description, eventDate, budget, location, createdAt]
  );
  const eventId = eventInsert[0]?.id;

  validation.participants.forEach((participant) => {
    executeSql(
      `INSERT INTO participants (event_id, name, email, created_at)
       VALUES (@p0, @p1, @p2, @p3)` ,
      [eventId, participant.name, participant.email, createdAt]
    );
  });

  respondJson(res, 201, {
    event: {
      id: eventId,
      name,
      description,
      eventDate,
      budget,
      location,
      createdAt,
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
  const events = querySql(
    'SELECT id, owner_id as ownerId, name FROM events WHERE id = @p0',
    [eventId]
  );
  if (events.length === 0 || events[0].ownerId !== req.user.userId) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const event = events[0];

  const participants = querySql(
    `SELECT id, name, email, email_status as emailStatus, assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = @p0`,
    [eventId]
  );
  if (participants.length < 2) {
    return sendBadRequest(res, 'Ajoutez au moins deux participants avant de lancer le tirage');
  }

  const assignments = buildAssignments(participants);
  const now = new Date().toISOString();
  const summary = [];

  for (const pair of assignments) {
    const message = `Bonjour ${pair.giver.name},\n\nVous offrirez un cadeau à ${pair.receiver.name} (${pair.receiver.email}).\nBonne préparation !`;
    try {
      await sendEmail(pair.giver.email, EMAIL_SUBJECT, message);
      executeSql(
        `UPDATE participants
         SET assigned_recipient_id = @p0, email_status = 'sent', email_error = NULL, email_sent_at = @p1
         WHERE id = @p2`,
        [pair.receiver.id, now, pair.giver.id]
      );
      summary.push({ participantId: pair.giver.id, status: 'sent' });
    } catch (error) {
      executeSql(
        `UPDATE participants
         SET assigned_recipient_id = @p0, email_status = 'failed', email_error = @p1, email_sent_at = @p2
         WHERE id = @p3`,
        [pair.receiver.id, String(error), now, pair.giver.id]
      );
      summary.push({ participantId: pair.giver.id, status: 'failed', error: String(error) });
    }
  }

  executeSql('UPDATE events SET draw_generated = 1 WHERE id = @p0', [eventId]);

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
  const events = querySql(
    `SELECT id, owner_id as ownerId, name, description, event_date as eventDate,
            budget, location, draw_generated as drawGenerated, created_at as createdAt
     FROM events WHERE id = @p0`,
    [eventId]
  );
  if (events.length === 0 || events[0].ownerId !== req.user.userId) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const event = events[0];
  const participants = querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = @p0`,
    [eventId]
  );
  respondJson(res, 200, { event, participants });
}

function getEventForOwner(eventId, ownerId) {
  if (!eventId) {
    return null;
  }
  const events = querySql(
    `SELECT id, owner_id as ownerId, name, description, event_date as eventDate,
            budget, location, draw_generated as drawGenerated, created_at as createdAt
     FROM events WHERE id = @p0`,
    [eventId]
  );
  if (events.length === 0) {
    return null;
  }
  const event = events[0];
  if (event.ownerId !== ownerId) {
    return null;
  }
  return event;
}

function getParticipantForEventById(eventId, participantId) {
  if (!participantId) {
    return null;
  }
  const participants = querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = @p0 AND id = @p1`,
    [eventId, participantId]
  );
  return participants[0] || null;
}

function getParticipantForEventByEmail(eventId, participantEmail) {
  const email = sanitizeEmail(participantEmail);
  if (!email) {
    return null;
  }
  const participants = querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = @p0 AND email = @p1`,
    [eventId, email]
  );
  return participants[0] || null;
}

async function listEventNotifications(req, res) {
  const eventId = Number(req.params.id);
  if (!eventId) {
    return sendBadRequest(res, 'Identifiant évènement invalide');
  }
  const event = getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const notifications = querySql(
    `SELECT id, name, email, email_status as emailStatus, email_error as emailError,
            email_sent_at as emailSentAt, assigned_recipient_id as assignedRecipientId
     FROM participants WHERE event_id = @p0
     ORDER BY created_at ASC`,
    [eventId]
  );
  respondJson(res, 200, { event: { id: event.id, name: event.name }, notifications });
}

async function acknowledgeNotification(req, res) {
  const eventId = Number(req.params.id);
  const participantId = Number(req.params.notificationId);
  if (!eventId || !participantId) {
    return sendBadRequest(res, 'Identifiants de notification invalides');
  }
  const event = getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const participant = getParticipantForEventById(eventId, participantId);
  if (!participant) {
    return sendNotFound(res, 'Notification introuvable');
  }
  const status = String(req.body.status || '').trim();
  if (!status) {
    return sendBadRequest(res, 'Statut de notification manquant');
  }
  executeSql(
    `UPDATE participants SET email_status = @p0 WHERE id = @p1 AND event_id = @p2`,
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
  const event = getEventForOwner(eventId, req.user.userId);
  if (!event) {
    return sendNotFound(res, "Évènement introuvable");
  }
  const participantEmail = sanitizeEmail(req.body.participantEmail);
  if (!participantEmail) {
    return sendBadRequest(res, 'Adresse email du participant manquante');
  }
  const participant = getParticipantForEventByEmail(eventId, participantEmail);
  if (!participant) {
    return sendNotFound(res, 'Participant introuvable');
  }
  if (!participant.assignedRecipientId) {
    return sendBadRequest(
      res,
      "Ce participant n'a pas encore reçu d'assignation de cadeau"
    );
  }
  const recipientRows = querySql(
    `SELECT id, name, email FROM participants WHERE id = @p0`,
    [participant.assignedRecipientId]
  );
  if (recipientRows.length === 0) {
    return sendNotFound(res, 'Assignation de cadeau introuvable');
  }
  const recipient = recipientRows[0];
  const message = `Bonjour ${participant.name},\n\nVous offrirez un cadeau à ${recipient.name} (${recipient.email}).\nBonne préparation !`;
  const now = new Date().toISOString();
  try {
    await sendEmail(participant.email, EMAIL_SUBJECT, message);
    executeSql(
      `UPDATE participants
       SET email_status = 'sent', email_error = NULL, email_sent_at = @p0
       WHERE id = @p1 AND event_id = @p2`,
      [now, participant.id, eventId]
    );
    respondJson(res, 200, {
      notification: {
        id: participant.id,
        status: 'sent',
        email: participant.email,
        name: participant.name,
        sentAt: now,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    executeSql(
      `UPDATE participants
       SET email_status = 'failed', email_error = @p0, email_sent_at = @p1
       WHERE id = @p2 AND event_id = @p3`,
      [errorMessage, now, participant.id, eventId]
    );
    respondJson(res, 500, {
      error: "L'envoi du message a échoué",
      details: errorMessage,
    });
  }
}

// ---- Application bootstrap ----------------------------------------------
const app = createApp();
app.use(jsonBodyParser);

app.post('/api/auth/register', (req, res) => registerUser(req, res));
app.post('/api/auth/login', (req, res) => loginUser(req, res));
app.post('/api/events', authMiddleware, (req, res) => createEvent(req, res));
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

app.listen(PORT, () => {
  console.log(`Secret Santa API disponible sur http://localhost:${PORT}`);
});
