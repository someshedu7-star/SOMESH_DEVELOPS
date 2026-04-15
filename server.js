const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://someshedu7-star.github.io';
const FRONTEND_SITE_URL = process.env.FRONTEND_SITE_URL || 'https://someshedu7-star.github.io/SOMESH_DEVELOPS/';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const publicDir = path.join(__dirname, 'public');
const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

function getCorsHeaders(req) {
  const origin = req.headers.origin;
  if (origin === FRONTEND_ORIGIN) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
  }
  return {};
}

function sendJson(req, res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getCorsHeaders(req),
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendText(req, res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...getCorsHeaders(req)
  });
  res.end(message);
}

function sanitizeText(value, maxLength) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, maxLength);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Request too large.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(filePath, req, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(req, res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream'
    });
    res.end(data);
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash).split(':');
  if (!salt || !originalHash) return false;
  const hashBuffer = Buffer.from(originalHash, 'hex');
  const testBuffer = crypto.scryptSync(password, salt, 64);
  return hashBuffer.length === testBuffer.length && crypto.timingSafeEqual(hashBuffer, testBuffer);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getAuthenticatedAdmin(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.admin_session;
  if (!sessionId || !sessions.has(sessionId)) return null;
  const session = sessions.get(sessionId);
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    sendJson(req, res, 401, { error: 'Admin login required.' });
    return null;
  }
  return admin;
}

function createSession(username) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    username,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
  return sessionId;
}

function buildAuthCookie(sessionId, req) {
  const isCrossOrigin = req.headers.origin === FRONTEND_ORIGIN;
  return isCrossOrigin
    ? `admin_session=${sessionId}; HttpOnly; Path=/; Max-Age=604800; SameSite=None; Secure`
    : `admin_session=${sessionId}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;
}

function buildClearCookie(req) {
  const isCrossOrigin = req.headers.origin === FRONTEND_ORIGIN;
  return isCrossOrigin
    ? 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure'
    : 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';
}

function ensureSupabase(req, res) {
  if (!supabase) {
    sendJson(req, res, 500, { error: 'Supabase is not configured on the backend.' });
    return false;
  }
  return true;
}

function reviewSummary(row) {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    rating: row.rating,
    createdAt: row.created_at,
    reply: row.reply_text
      ? {
          text: row.reply_text,
          author: row.reply_author,
          createdAt: row.reply_created_at
        }
      : null
  };
}

async function getAllReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,name,message,rating,created_at,reply_text,reply_author,reply_created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(reviewSummary);
}

async function getAdminByUsername(username) {
  const { data, error } = await supabase
    .from('admins')
    .select('id,username,password_hash,created_at')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAdminCount() {
  const { count, error } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

async function handlePublicReviews(req, res) {
  if (!ensureSupabase(req, res)) return;

  if (req.method === 'GET') {
    try {
      const reviews = await getAllReviews();
      sendJson(req, res, 200, reviews);
    } catch (error) {
      sendJson(req, res, 500, { error: 'Unable to load reviews right now.' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const parsed = await parseJsonBody(req);
      const name = sanitizeText(parsed.name, 60);
      const message = sanitizeText(parsed.message, 300);
      const rating = Number(parsed.rating);

      if (!name || !message || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        sendJson(req, res, 400, { error: 'Please send a valid name, review, and rating.' });
        return;
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert({ name, message, rating })
        .select('id,name,message,rating,created_at,reply_text,reply_author,reply_created_at')
        .single();

      if (error) throw error;
      sendJson(req, res, 201, reviewSummary(data));
    } catch (error) {
      sendJson(req, res, 400, { error: error.message || 'Unable to save the review.' });
    }
    return;
  }

  sendJson(req, res, 405, { error: 'Method not allowed.' });
}

async function handleAdminAuth(req, res, pathname) {
  if (!ensureSupabase(req, res)) return true;

  if (pathname === '/api/admin/status' && req.method === 'GET') {
    try {
      const adminCount = await getAdminCount();
      const session = getAuthenticatedAdmin(req);
      sendJson(req, res, 200, {
        setupRequired: adminCount === 0,
        authenticated: Boolean(session),
        username: session ? session.username : null
      });
    } catch (error) {
      sendJson(req, res, 500, { error: 'Unable to check admin status.' });
    }
    return true;
  }

  if (pathname === '/api/admin/signup' && req.method === 'POST') {
    try {
      const adminCount = await getAdminCount();
      if (adminCount > 0) {
        sendJson(req, res, 403, { error: 'Admin signup is already completed. Please log in.' });
        return true;
      }

      const parsed = await parseJsonBody(req);
      const username = sanitizeText(parsed.username, 32);
      const password = String(parsed.password || '').trim();

      if (!username || password.length < 6) {
        sendJson(req, res, 400, { error: 'Use a username and a password with at least 6 characters.' });
        return true;
      }

      const { error } = await supabase
        .from('admins')
        .insert({
          username,
          password_hash: hashPassword(password)
        });

      if (error) throw error;
      const sessionId = createSession(username);
      sendJson(req, res, 201, { message: 'Admin account created.', username }, {
        'Set-Cookie': buildAuthCookie(sessionId, req)
      });
    } catch (error) {
      sendJson(req, res, 400, { error: error.message || 'Unable to create the admin account.' });
    }
    return true;
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const parsed = await parseJsonBody(req);
      const username = sanitizeText(parsed.username, 32);
      const password = String(parsed.password || '');
      const admin = await getAdminByUsername(username);

      if (!admin || !verifyPassword(password, admin.password_hash)) {
        sendJson(req, res, 401, { error: 'Invalid username or password.' });
        return true;
      }

      const sessionId = createSession(admin.username);
      sendJson(req, res, 200, { message: 'Login successful.', username: admin.username }, {
        'Set-Cookie': buildAuthCookie(sessionId, req)
      });
    } catch (error) {
      sendJson(req, res, 400, { error: error.message || 'Unable to log in.' });
    }
    return true;
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.admin_session) sessions.delete(cookies.admin_session);
    sendJson(req, res, 200, { message: 'Logged out.' }, {
      'Set-Cookie': buildClearCookie(req)
    });
    return true;
  }

  return false;
}

async function handleAdminReviews(req, res, pathname) {
  if (!ensureSupabase(req, res)) return true;

  if (pathname === '/api/admin/reviews' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return true;

    try {
      const reviews = await getAllReviews();
      sendJson(req, res, 200, {
        username: admin.username,
        reviews
      });
    } catch (error) {
      sendJson(req, res, 500, { error: 'Unable to load reviews right now.' });
    }
    return true;
  }

  const replyMatch = pathname.match(/^\/api\/admin\/reviews\/(\d+)\/reply$/);
  if (replyMatch && req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return true;

    try {
      const parsed = await parseJsonBody(req);
      const reply = sanitizeText(parsed.reply, 300);
      if (!reply) {
        sendJson(req, res, 400, { error: 'Reply cannot be empty.' });
        return true;
      }

      const reviewId = Number(replyMatch[1]);
      const { data, error } = await supabase
        .from('reviews')
        .update({
          reply_text: reply,
          reply_author: admin.username,
          reply_created_at: new Date().toISOString()
        })
        .eq('id', reviewId)
        .select('id,name,message,rating,created_at,reply_text,reply_author,reply_created_at')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        sendJson(req, res, 404, { error: 'Review not found.' });
        return true;
      }

      sendJson(req, res, 200, reviewSummary(data));
    } catch (error) {
      sendJson(req, res, 400, { error: error.message || 'Unable to save reply.' });
    }
    return true;
  }

  const deleteMatch = pathname.match(/^\/api\/admin\/reviews\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return true;

    try {
      const reviewId = Number(deleteMatch[1]);
      const { data, error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        sendJson(req, res, 404, { error: 'Review not found.' });
        return true;
      }

      sendJson(req, res, 200, { message: 'Review deleted.' });
    } catch (error) {
      sendJson(req, res, 400, { error: error.message || 'Unable to delete review.' });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(req));
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(req, res, 200, {
      ok: true,
      frontendOrigin: FRONTEND_ORIGIN,
      frontendSiteUrl: FRONTEND_SITE_URL,
      supabaseConfigured: Boolean(supabase)
    });
    return;
  }

  if (pathname === '/api/reviews') {
    await handlePublicReviews(req, res);
    return;
  }

  if (pathname.startsWith('/api/admin/')) {
    if (await handleAdminAuth(req, res, pathname)) return;
    if (await handleAdminReviews(req, res, pathname)) return;
    sendJson(req, res, 404, { error: 'Admin route not found.' });
    return;
  }

  const safePath = pathname === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, pathname);
  const resolvedPath = path.normalize(safePath);
  if (!resolvedPath.startsWith(publicDir)) {
    sendText(req, res, 403, 'Forbidden');
    return;
  }

  serveFile(resolvedPath, req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Personal blog backend running at http://localhost:${PORT}`);
  });
}

function playPiano(){
  document.getElementById("pianoSound").play();
}

module.exports = server;
