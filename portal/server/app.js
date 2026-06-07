import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import { loadDb } from './data/store.js';
import { findUserBySession } from './auth.js';
import authRoutes from './routes/auth.routes.js';
import domainRoutes from './routes/domain.routes.js';
import documentRoutes from './routes/documents.routes.js';
import employmentRoutes from './routes/employment.routes.js';

await loadDb();

const app = express();

app.use(cors((req, callback) => {
  const origin = req.header('origin');

  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  if (config.clientOrigins.includes(origin)) {
    return callback(null, { origin: true, credentials: true });
  }

  try {
    const originUrl = new URL(origin);
    const requestHost = req.header('x-forwarded-host') || req.header('host');
    const requestProto = (req.header('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();

    if (requestHost && originUrl.host === requestHost && originUrl.protocol === `${requestProto}:`) {
      return callback(null, { origin: true, credentials: true });
    }
  } catch {
  }

  return callback(new Error('Origin not allowed by portal CORS policy'));
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  req.user = findUserBySession(req);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'alpha-portal',
    mode: process.env.NODE_ENV || 'development',
    database: config.databaseUrl ? 'postgres' : 'local-json',
    storage: config.storageDriver,
    email: config.emailDriver
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', domainRoutes);
app.use('/api', documentRoutes);
app.use('/api', employmentRoutes);

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const dist = path.join(config.root, 'client', 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Server error' });
});

export default app;
