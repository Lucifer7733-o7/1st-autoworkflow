import crypto from 'node:crypto';

const COOKIE = 'hs_session';

function sign(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Single-user auth: one password from APP_PASSWORD, a signed expiring cookie.
export function createAuth({ password, sessionSecret, sessionDays }) {
  const enabled = Boolean(password);
  const failures = new Map(); // ip -> { count, until }

  function issue(res, secure) {
    const expires = Date.now() + sessionDays * 86400_000;
    const payload = String(expires);
    res.cookie(COOKIE, `${payload}.${sign(sessionSecret, payload)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      expires: new Date(expires),
    });
  }

  function isValid(req) {
    if (!enabled) return true;
    const raw = req.cookies?.[COOKIE];
    if (!raw) return false;
    const [payload, sig] = raw.split('.');
    if (!payload || !sig || !safeEqual(sig, sign(sessionSecret, payload))) return false;
    return Number(payload) > Date.now();
  }

  function login(req, res) {
    if (!enabled) return res.json({ ok: true, authEnabled: false });
    const ip = req.ip;
    const f = failures.get(ip);
    if (f && f.until > Date.now()) {
      return res.status(429).json({ error: 'Too many attempts, try again in a minute.' });
    }
    const given = String(req.body?.password ?? '');
    // Compare hashes so lengths always match.
    const ok = safeEqual(sign(sessionSecret, given), sign(sessionSecret, password));
    if (!ok) {
      const count = (f?.count || 0) + 1;
      failures.set(ip, { count, until: count >= 5 ? Date.now() + 60_000 : 0 });
      return res.status(401).json({ error: 'Wrong password' });
    }
    failures.delete(ip);
    issue(res, req.secure);
    res.json({ ok: true });
  }

  function logout(_req, res) {
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  }

  function me(req, res) {
    res.json({ authEnabled: enabled, loggedIn: isValid(req) });
  }

  function requireAuth(req, res, next) {
    if (isValid(req)) return next();
    res.status(401).json({ error: 'Not logged in' });
  }

  return { enabled, login, logout, me, requireAuth };
}
