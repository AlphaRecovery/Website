import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import { loadDb } from './data/store.js';
import { findUserBySession } from './auth.js';
import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contact.routes.js';
import domainRoutes from './routes/domain.routes.js';
import documentRoutes from './routes/documents.routes.js';
import employmentRoutes from './routes/employment.routes.js';
import { createRateLimiter } from './middleware/rateLimit.js';

await loadDb();

const app = express();
app.set('trust proxy', 1);

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 25, keyPrefix: 'auth', methods: ['POST'] });
const contactLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'contact', methods: ['POST'], message: 'Too many contact requests. Please try again shortly.' });
const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'write', methods: ['POST', 'PATCH', 'DELETE'] });
const uploadLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: 'upload', methods: ['POST'] });

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

app.use(
  [
    '/api/auth/login',
    '/api/auth/register-applicant',
    '/api/auth/accept-invite',
    '/api/auth/request-password-reset',
    '/api/auth/reset-password'
  ],
  authLimiter
);
app.use('/api/contact', contactLimiter);
app.use(['/api/messages', '/api/tasks', '/api/documents/request', '/api/companies'], writeLimiter);
app.use(['/api/application/submit', '/api/documents'], uploadLimiter);

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

app.use('/api', contactRoutes);
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
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Uploaded files must be 10MB or smaller.' });
  }
  if (error?.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Unsupported file type. Upload PDF, JPG, JPEG, PNG, DOC, or DOCX files only.' });
  }
  res.status(500).json({ error: error.message || 'Server error' });
});

export default app;
