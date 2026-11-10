import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const failure = (message, status = 503) => Object.assign(new Error(message), { status });
export function cloudServices(config, { fetcher = fetch, env = process.env } = {}) {
  const authEnabled = config.authBackend === 'supabase' && !config.testing,
    storageEnabled = config.storageBackend === 'supabase' && !config.testing;
  let base;
  if (authEnabled || storageEnabled) {
    base = new URL(env.SUPABASE_URL);
    if (
      base.protocol !== 'https:' ||
      !/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) ||
      base.username ||
      base.password ||
      base.port ||
      base.pathname !== '/' ||
      !env.SUPABASE_SECRET_KEY
    )
      throw Error('Supabase URL/server key are required.');
  }
  const bucket = env.SUPABASE_STORAGE_BUCKET || 'carbonx-evidence';
  if (!/^[a-z0-9-]{3,63}$/.test(bucket)) throw Error('Invalid private bucket name.');
  async function request(route, { method = 'GET', json, body, token, headers = {} } = {}) {
    let response;
    try {
      response = await fetcher(new URL(route, base), {
        method,
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: 'Bearer ' + (token || env.SUPABASE_SECRET_KEY),
          ...(json ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: json ? JSON.stringify(json) : body,
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw failure('Supabase service is unavailable. Retry shortly.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const embedded = Number(payload.statusCode),
        status =
          response.status === 400 && [404, 409, 413].includes(embedded)
            ? embedded
            : response.status;
      throw failure(
        status === 401 || status === 400
          ? 'Email or password is incorrect, or confirmation is pending.'
          : 'Supabase request failed (HTTP ' + status + ').',
        status === 401 || status === 400
          ? 401
          : status === 404
            ? 404
            : status === 409 || status === 422
              ? 409
              : 503,
      );
    }
    return response;
  }
  const json = async (route, options) => (await request(route, options)).json();
  async function signup(email, password, name) {
    const result = await json('/auth/v1/signup', {
      method: 'POST',
      json: { email, password, data: { display_name: name } },
    });
    const user = result.user || result;
    if (!user.id) throw failure('Supabase did not return an identity.');
    return { id: user.id, confirmationRequired: !result.access_token };
  }
  async function provision(email, password, name) {
    const result = await json('/auth/v1/admin/users', {
      method: 'POST',
      json: { email, password, email_confirm: true, user_metadata: { display_name: name } },
    });
    const user = result.user || result;
    if (!user.id) throw failure('Supabase did not return an identity.');
    return user.id;
  }
  async function signin(email, password) {
    const result = await json('/auth/v1/token?grant_type=password', {
      method: 'POST',
      json: { email, password },
    });
    if (result.user?.factors?.some((f) => f.status === 'verified'))
      throw failure('This account requires MFA; a second-factor sign-in flow is required.', 401);
    if (!result.user?.id || !result.access_token)
      throw failure('Cloud sign-in did not return a valid identity.', 401);
    return result;
  }
  async function authenticate(user, password) {
    if (!authEnabled || user.is_example) return null;
    if (!user.auth_user_id) {
      try {
        await provision(user.email, password, user.name);
      } catch (e) {
        if (e.status !== 409) throw e;
      }
    }
    const result = await signin(user.email, password);
    if (
      (user.auth_user_id && result.user.id !== user.auth_user_id) ||
      result.user.email?.toLowerCase() !== user.email.toLowerCase()
    )
      throw failure('Account identity does not match.', 401);
    return result.user.id;
  }
  const identities = new Map(),
    identityChecks = new Map();
  async function checkIdentity(user) {
    if (!authEnabled || user.is_example || !user.auth_user_id) return;
    const id = user.auth_user_id;
    if ((identities.get(id) || 0) > Date.now()) return;
    if (identityChecks.has(id)) return identityChecks.get(id);
    const work = (async () => {
      let result;
      try {
        result = await json('/auth/v1/admin/users/' + encodeURIComponent(id));
      } catch (e) {
        if (e.status === 404)
          throw failure('Cloud account is unavailable. Please sign in again.', 401);
        throw e;
      }
      const value = result.user || result;
      if (
        value.id !== id ||
        value.deleted_at ||
        (value.banned_until && Date.parse(value.banned_until) > Date.now())
      )
        throw failure('Cloud account access is unavailable.', 401);
      identities.set(id, Date.now() + 60000);
      if (identities.size > 1000) identities.delete(identities.keys().next().value);
    })().finally(() => identityChecks.delete(id));
    identityChecks.set(id, work);
    return work;
  }
  async function changePassword(user, current, password) {
    if (!authEnabled || user.is_example) return;
    const session = await signin(user.email, current);
    if (session.user.id !== user.auth_user_id)
      throw failure('Account identity does not match.', 401);
    await json('/auth/v1/user', { method: 'PUT', token: session.access_token, json: { password } });
    identities.delete(user.auth_user_id);
  }
  let bucketReady = false,
    bucketPending;
  async function ensureBucket() {
    if (!storageEnabled) return;
    if (bucketReady) return;
    if (bucketPending) return bucketPending;
    bucketPending = (async () => {
      let info;
      try {
        info = await json('/storage/v1/bucket/' + bucket);
      } catch (e) {
        if (e.status !== 404) throw e;
        try {
          await json('/storage/v1/bucket', {
            method: 'POST',
            json: {
              id: bucket,
              name: bucket,
              public: false,
              file_size_limit: config.maxUpload || 26214400,
              allowed_mime_types: ['application/pdf', 'text/plain'],
            },
          });
        } catch (e) {
          if (e.status !== 409) throw e;
        }
        info = await json('/storage/v1/bucket/' + bucket);
      }
      if (info.public !== false) throw failure('The CarbonX evidence bucket must be private.');
      bucketReady = true;
    })().finally(() => {
      bucketPending = null;
    });
    return bucketPending;
  }
  function objectPath(report) {
    if (
      !/^[A-Za-z0-9_-]+$/.test(report.company_id) ||
      !/^[A-Za-z0-9_.-]+$/.test(report.stored_name) ||
      report.stored_name.includes('..')
    )
      throw Error('Invalid evidence object path.');
    return bucket + '/' + report.company_id + '/' + report.stored_name;
  }
  async function saveOriginal(report, bytes) {
    if (!storageEnabled) return;
    await ensureBucket();
    await request('/storage/v1/object/' + objectPath(report), {
      method: 'POST',
      body: bytes,
      headers: { 'content-type': report.mime, 'x-upsert': 'true' },
    });
  }
  async function download(report) {
    if (!storageEnabled || /^demo_[a-f0-9]{28}\.txt$/.test(report.stored_name)) {
      const bytes = fs.readFileSync(path.join(config.dataDir, 'uploads', report.stored_name));
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== report.sha256)
        throw failure('Evidence checksum verification failed.');
      return bytes;
    }
    const response = await request('/storage/v1/object/' + objectPath(report));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== report.sha256)
      throw failure('Evidence checksum verification failed.');
    return bytes;
  }
  async function originalPath(report) {
    if (!storageEnabled || /^demo_[a-f0-9]{28}\.txt$/.test(report.stored_name))
      return path.join(config.dataDir, 'uploads', report.stored_name);
    const filename = path.join(config.dataDir, 'cache', report.company_id, report.stored_name);
    if (
      fs.existsSync(filename) &&
      crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') === report.sha256
    )
      return filename;
    const bytes = await download(report);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, bytes);
    return filename;
  }
  return {
    authEnabled,
    storageEnabled,
    signup,
    provision,
    authenticate,
    checkIdentity,
    changePassword,
    ensureBucket,
    saveOriginal,
    download,
    originalPath,
    request,
  };
}
