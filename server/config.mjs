import path from 'node:path';
const aiProvider = process.env.AI_PROVIDER || 'ollama';
export const config = {
  port: Number(process.env.PORT || 8765),
  host: process.env.HOST || '127.0.0.1',
  dataDir: path.resolve(process.env.DATA_DIR || '.data'),
  maxUpload: Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024,
  secureCookies: process.env.COOKIE_SECURE === 'true',
  allowDemo: process.env.ALLOW_DEMO !== 'false',
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  aiProvider,
  aiEnabled:
    aiProvider === 'ollama'
      ? Boolean(process.env.OLLAMA_MODEL)
      : process.env.ALLOW_PAID_AI === 'true' &&
        process.env.ENABLE_HOSTED_AI === 'true' &&
        Boolean(process.env.OPENAI_API_KEY) &&
        Boolean(process.env.OPENAI_MODEL),
  aiModel:
    aiProvider === 'ollama' ? process.env.OLLAMA_MODEL || '' : process.env.OPENAI_MODEL || '',
  embeddingModel:
    aiProvider === 'ollama'
      ? process.env.OLLAMA_EMBEDDING_MODEL || ''
      : process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  ocrEnabled: process.env.ENABLE_OCR !== 'false',
  production: process.argv.includes('--production'),
  monitoringEnabled: process.env.ENABLE_MONITORING !== 'false',
  monitorPollMinutes: Math.max(15, Math.min(1440, Number(process.env.MONITOR_POLL_MINUTES) || 30)),
};
