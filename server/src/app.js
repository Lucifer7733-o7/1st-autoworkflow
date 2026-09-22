import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuth } from './auth.js';
import { createApi } from './api.js';

export function createApp({ db, scanner, config }) {
  const app = express();
  const auth = createAuth(config);

  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/login', auth.login);
  app.post('/api/logout', auth.logout);
  app.get('/api/me', auth.me);
  app.use('/api', auth.requireAuth, createApi({ db, scanner, config }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built web player, falling back to index.html for client-side routes.
  const index = path.join(config.webDist, 'index.html');
  if (fs.existsSync(index)) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(index));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('API is running. Build the web player with `npm run build`, or use `npm run dev`.'),
    );
  }

  return app;
}
