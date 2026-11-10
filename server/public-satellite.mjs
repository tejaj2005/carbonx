import rateLimit from 'express-rate-limit';
export function publicSatelliteRoutes(app, satellite, orbit, config) {
  app.use(
    '/api/public/satellite',
    rateLimit({
      windowMs: 60000,
      limit: config.testing ? 1000 : 90,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Satellite refresh limit reached. Retry shortly.' },
    }),
  );
  app.get('/api/public/satellite/live', async (_req, res) => {
    try {
      const data = await satellite.metadata();
      res.json({
        ...data,
        imageUrl: data.imageUrl.replace(
          '/api/environment/satellite/live/image',
          '/api/public/satellite/image',
        ),
      });
    } catch {
      res.status(503).json({ error: 'EUMETSAT imagery is temporarily unavailable.' });
    }
  });
  app.get('/api/public/satellite/position', async (_req, res) => {
    try {
      res.json(await orbit.position());
    } catch {
      res.status(503).json({ error: 'ISS position is temporarily unavailable.' });
    }
  });
  app.get('/api/public/satellite/image', (_req, res) => {
    try {
      res.type('png').send(satellite.frameAt(String(_req.query.t || '')).bytes);
    } catch {
      res.status(404).json({ error: 'Satellite frame expired. Refresh the view.' });
    }
  });
}
