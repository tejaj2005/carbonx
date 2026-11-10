import { checkSupabase, checkSupabaseApi } from '../server/supabase.mjs';
const [database, api] = await Promise.all([checkSupabase(), checkSupabaseApi()]);
console.log(
  JSON.stringify(
    {
      database,
      api,
      note: 'Connection verification only. Application records and files still use SQLite and local uploads.',
    },
    null,
    2,
  ),
);
if (database.status !== 'connected' || api.status !== 'connected') process.exitCode = 1;
