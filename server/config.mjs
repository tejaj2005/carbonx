import path from 'node:path';
export function readConfig(env = process.env) {
  const selected = (env.AI_PROVIDER || 'groq').trim().toLowerCase();
  const aiProvider = selected === 'grok' ? 'xai' : selected;
  if (!['groq', 'xai', 'ollama', 'openai'].includes(aiProvider))
    throw Error('AI_PROVIDER must be groq, xai, ollama or openai.');
  const hostedEnabled = env.ENABLE_HOSTED_AI !== 'false';
  return {
    databaseBackend: env.DB_BACKEND || 'sqlite',
    authBackend: env.AUTH_BACKEND || 'local',
    storageBackend: env.STORAGE_BACKEND || 'local',
    port: Number(env.PORT || 8765),
    host: env.HOST || '127.0.0.1',
    dataDir: path.resolve(env.DATA_DIR || '.data'),
    maxUpload: Number(env.MAX_UPLOAD_MB || 25) * 1024 * 1024,
    secureCookies: env.COOKIE_SECURE === 'true',
    allowDemo: env.ALLOW_DEMO !== 'false',
    allowRegistration: env.ALLOW_REGISTRATION !== 'false',
    aiProvider,
    aiEnabled:
      aiProvider === 'groq'
        ? hostedEnabled &&
          Boolean(env.GROQ_API_KEY?.trim()) &&
          Boolean((env.GROQ_MODEL || 'openai/gpt-oss-20b').trim())
        : aiProvider === 'xai'
          ? hostedEnabled &&
            Boolean(env.XAI_API_KEY?.trim()) &&
            Boolean((env.XAI_MODEL || 'grok-4.7').trim())
          : aiProvider === 'ollama'
            ? Boolean(env.OLLAMA_MODEL)
            : env.ALLOW_PAID_AI === 'true' &&
              env.ENABLE_HOSTED_AI === 'true' &&
              Boolean(env.OPENAI_API_KEY) &&
              Boolean(env.OPENAI_MODEL),
    aiModel:
      aiProvider === 'groq'
        ? (env.GROQ_MODEL || 'openai/gpt-oss-20b').trim()
        : aiProvider === 'xai'
          ? (env.XAI_MODEL || 'grok-4.7').trim()
          : aiProvider === 'ollama'
            ? env.OLLAMA_MODEL || ''
            : env.OPENAI_MODEL || '',
    embeddingModel: ['xai', 'groq'].includes(aiProvider)
      ? ''
      : aiProvider === 'ollama'
        ? env.OLLAMA_EMBEDDING_MODEL || ''
        : env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    ocrEnabled: env.ENABLE_OCR !== 'false',
    production: process.argv.includes('--production'),
    monitoringEnabled: env.ENABLE_MONITORING !== 'false',
    monitorPollMinutes: Math.max(15, Math.min(1440, Number(env.MONITOR_POLL_MINUTES) || 30)),
  };
}
export const config = readConfig();
