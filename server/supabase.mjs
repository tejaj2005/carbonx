import pg from 'pg';
export async function checkSupabase(env = process.env, Client = pg.Client) {
  if (!env.SUPABASE_DB_URL) return { status: 'not_configured', persistence: 'sqlite' };
  let uri;
  try {
    uri = new URL(env.SUPABASE_DB_URL);
    const project = new URL(env.SUPABASE_URL).hostname.split('.')[0];
    if (
      uri.protocol !== 'postgresql:' ||
      !/^[a-z0-9]+$/.test(project) ||
      !(
        uri.hostname === 'db.' + project + '.supabase.co' ||
        (uri.hostname.endsWith('.pooler.supabase.com') &&
          decodeURIComponent(uri.username) === 'postgres.' + project)
      )
    )
      throw Error('Invalid project connection');
    // Connection-string SSL options must not override certificate validation.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) uri.searchParams.delete(key);
  } catch {
    return { status: 'invalid_configuration', persistence: 'sqlite' };
  }
  const client = new Client({
    connectionString: uri.toString(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    application_name: 'carbonx_connection_check',
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query(
      "SELECT current_database() AS database, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables",
    );
    await client.query('ROLLBACK');
    if (result.rows[0]?.tls !== true) return { status: 'tls_required', persistence: 'sqlite' };
    return {
      status: 'connected',
      tlsVerified: true,
      publicTableCount: result.rows[0].tables,
      persistence: 'sqlite',
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    if (process.argv.includes('--diagnostic'))
      console.log({
        code: /^[A-Z0-9_]{1,45}$/.test(e.code || '') ? e.code : 'no_code',
        timeout: /timeout|timed out/i.test(e.message),
        tenant: /tenant|user not found/i.test(e.message),
        password: /password|authentication/i.test(e.message),
        certificate: /certificate/i.test(e.message),
        network: /network|connect|socket|terminated/i.test(e.message),
      });
    return {
      status:
        e.code === '28P01'
          ? 'authentication_failed'
          : /CERT|SELF_SIGNED|VERIFY/.test(e.code || '')
            ? 'certificate_error'
            : ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'].includes(e.code) ||
                /timeout|timed out/i.test(e.message)
              ? 'network_unavailable'
              : 'connection_failed',
      persistence: 'sqlite',
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function checkSupabaseApi(env = process.env, fetcher = fetch) {
  let base;
  try {
    base = new URL(env.SUPABASE_URL);
    if (
      base.protocol !== 'https:' ||
      !/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) ||
      base.username ||
      base.password ||
      base.port ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    )
      throw Error('Invalid URL');
  } catch {
    return { status: 'invalid_configuration' };
  }
  if (!env.SUPABASE_SECRET_KEY?.trim()) return { status: 'key_required' };
  const checks = await Promise.all(
    ['/rest/v1/', '/auth/v1/health'].map(async (path) => {
      try {
        const response = await fetcher(new URL(path, base), {
          headers: { apikey: env.SUPABASE_SECRET_KEY.trim() },
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        return response.ok
          ? 'connected'
          : response.status === 401 || response.status === 403
            ? 'key_rejected'
            : 'unavailable';
      } catch {
        return 'network_unavailable';
      }
    }),
  );
  return {
    status: checks.every((x) => x === 'connected') ? 'connected' : 'partial',
    dataApi: checks[0],
    authHealth: checks[1],
    checkedAt: new Date().toISOString(),
    persistence: 'sqlite',
  };
}
