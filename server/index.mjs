import path from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import { config } from './config.mjs';
import { createApp } from './app.mjs';
const { app, store, monitoring, errorHandler } = createApp(config);
const server = createServer(app);
let vite;
if (config.production) {
  app.use(express.static(path.resolve('dist'), { index: false, maxAge: '1h' }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer: createVite } = await import('vite');
  vite = await createVite({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use(errorHandler);
server.on('error', (e) => {
  console.error(
    e.code === 'EADDRINUSE'
      ? 'CarbonX port ' +
          config.port +
          ' is already in use. Stop only the existing CarbonX server or choose PORT in .env.'
      : e.message,
  );
  process.exit(1);
});
server.listen(config.port, config.host, () =>
  console.log(
    'CarbonX ready at http://' +
      config.host +
      ':' +
      config.port +
      ' | ' +
      (config.aiEnabled
        ? 'AI configured'
        : 'keyword baseline; configure GROQ_API_KEY in .env for AI'),
  ),
);
monitoring.start();
async function stop() {
  server.close(async () => {
    await monitoring.stop();
    if (vite) await vite.close();
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
