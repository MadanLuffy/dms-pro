import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(root, 'dist', 'index.html');
const schema = path.join(root, 'server', 'prisma', 'schema.prisma');
const pgSchema = path.join(root, 'server', 'prisma', 'schema.postgresql.prisma');
const envExample = path.join(root, 'server', '.env.example');
const envProdExample = path.join(root, 'server', '.env.production.example');
const envFile = path.join(root, 'server', '.env');

const missing = [];
if (!fs.existsSync(distIndex)) missing.push('dist/index.html (run npm run build)');
if (!fs.existsSync(schema)) missing.push('server/prisma/schema.prisma');
if (!fs.existsSync(pgSchema)) missing.push('server/prisma/schema.postgresql.prisma');
if (!fs.existsSync(envExample)) missing.push('server/.env.example');
if (!fs.existsSync(envProdExample)) missing.push('server/.env.production.example');

if (missing.length) {
  console.error('[deploy-check] Missing:');
  for (const item of missing) console.error('  -', item);
  process.exit(1);
}

const errors = [];
if (fs.existsSync(envFile)) {
  const env = fs.readFileSync(envFile, 'utf8');
  const weakSecrets = ['dms-pro-dev-secret-change-me-in-production', 'change-me-in-production'];
  if (weakSecrets.some((s) => env.includes(s))) {
    errors.push('server/.env still contains the default/dev JWT secret. Set a strong random JWT_SECRET.');
  }
  if (/DATABASE_URL=.*file:\.\/dev\.db/.test(env.split('\n').find((l) => l.startsWith('DATABASE_URL')) || '')) {
    errors.push('server/.env points at local SQLite (file:./dev.db). Production must use DATABASE_URL for Postgres.');
  }
  if (env.includes('CLIENT_ORIGIN="http://localhost:5188"')) {
    errors.push('server/.env CLIENT_ORIGIN is the local dev origin. Set it to your public https origin for production.');
  }
}

if (errors.length) {
  console.error('[deploy-check] BLOCKING issues:');
  for (const e of errors) console.error('  ✗', e);
  console.error('[deploy-check] See server/.env.production.example and set real values on the host.');
  process.exit(1);
}

console.log('[deploy-check] OK: production build, schemas, and env templates are present.');
console.log('[deploy-check] Next (Postgres):  npm run db:generate:pg --prefix server');
console.log('[deploy-check] Next (schema):    npm run db:push:pg --prefix server   (or prisma migrate deploy)');
console.log('[deploy-check] Next (seed):      npm run db:seed --prefix server   (creates bootstrap admin in prod)');
console.log('[deploy-check] Next (run):       npm start --prefix server');
console.log('[deploy-check] Health: GET /api/health');
