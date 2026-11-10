import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { uuid, now } from './db.mjs';
const scrypt = promisify(crypto.scrypt);
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return salt + ':' + key.toString('hex');
}
export async function checkPassword(password, hash) {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const result = await scrypt(password, salt, 64);
  const stored = Buffer.from(key, 'hex');
  return result.length === stored.length && crypto.timingSafeEqual(result, stored);
}
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function authTools(store, config, cloud) {
  async function publicUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      company: user.company_name,
      isExample: Boolean(user.is_example),
      portal: (await store.get('SELECT user_id FROM government_admins WHERE user_id=?', user.id))
        ? 'government'
        : 'company',
    };
  }
  async function issue(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url'),
      csrf = crypto.randomBytes(24).toString('base64url');
    await store.run(
      'INSERT INTO sessions VALUES(?,?,?,?)',
      digest(token),
      userId,
      csrf,
      new Date(Date.now() + 86400000).toISOString(),
    );
    res.cookie('carbonx_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureCookies,
      maxAge: 86400000,
      path: '/',
    });
    return csrf;
  }
  async function requireAuth(req, res, next) {
    const token = req.cookies.carbonx_session;
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const user = await store.get(
      'SELECT u.*,c.name company_name,c.is_example,s.csrf,s.expires FROM sessions s JOIN users u ON u.id=s.user_id JOIN companies c ON c.id=u.company_id WHERE s.id=?',
      digest(token),
    );
    if (!user || user.disabled || user.expires < now())
      return res.status(401).json({ error: 'Your session expired. Please sign in.' });
    await cloud?.checkIdentity(user);
    req.user = user;
    next();
  }
  function originCheck(req, res, next) {
    const origin = req.get('origin');
    if (origin && origin !== req.protocol + '://' + req.get('host'))
      return res.status(403).json({ error: 'Cross-origin requests are not permitted.' });
    next();
  }
  function csrfCheck(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('X-CSRF-Token') !== req.user.csrf)
      return res.status(403).json({ error: 'Refresh the page before submitting this change.' });
    originCheck(req, res, next);
  }
  function roles(...allowed) {
    return (req, res, next) =>
      allowed.includes(req.user.role)
        ? next()
        : res.status(403).json({ error: 'Your role cannot perform this action.' });
  }
  async function logout(req, res) {
    if (req.cookies.carbonx_session)
      await store.run('DELETE FROM sessions WHERE id=?', digest(req.cookies.carbonx_session));
    res.clearCookie('carbonx_session', { path: '/' });
  }
  return { publicUser, issue, requireAuth, csrfCheck, originCheck, roles, logout };
}
