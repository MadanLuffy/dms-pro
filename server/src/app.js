import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import fileRoutes from './routes/file.routes.js';
import auditRoutes from './routes/audit.routes.js';
import metaRoutes from './routes/meta.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { requireAuth } from './middleware/auth.js';
import { prisma } from './lib/prisma.js';
import { streamUpload } from './controllers/upload.controller.js';
import { notFound, errorHandler } from './middleware/error.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { getClientOrigins } from './config.js';

import { listDemoUsers } from './controllers/meta.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ORIGINS = getClientOrigins();

const CLIENT_BUILD_PATH = path.join(__dirname, '../../dist');
const IS_PROD = process.env.NODE_ENV === 'production';

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (IS_PROD) {
    const connectSrc = ["'self'", 'ws:', 'wss:', ...CLIENT_ORIGINS].join(' ');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        `connect-src ${connectSrc}`,
        "frame-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
      ].join('; ')
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function createApp() {
  const app = express();

  if (IS_PROD || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || CLIENT_ORIGINS.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(securityHeaders);

  app.get(['/health', '/api/health'], async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up', ts: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'down', ts: new Date().toISOString() });
    }
  });

  app.use('/api', apiRateLimit);

  app.get('/uploads/:filename', requireAuth, streamUpload);

  if (!IS_PROD) {
    app.get('/api/demo-users', listDemoUsers);
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api', metaRoutes);

  if (IS_PROD && fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html'))) {
    app.use(express.static(CLIENT_BUILD_PATH));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/socket.io')
      ) {
        return next();
      }
      res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
