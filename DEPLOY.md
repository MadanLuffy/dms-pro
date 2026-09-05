# DMS Pro production deploy

Unified Option A (recommended): one Node process serves `/api`, Socket.io, uploads, and the Vite `dist/` SPA.

## 1. Build and push schema

```bash
npm install
npm install --prefix server
npm run build
```

SQLite (single instance / small teams):

```bash
cd server
npx prisma db push
# First admin only — never seeds demo passwords when NODE_ENV=production
NODE_ENV=production BOOTSTRAP_ADMIN_EMAIL=admin@your-org.com BOOTSTRAP_ADMIN_PASSWORD='…' node prisma/seed.js
```

PostgreSQL (required once multiple writers exist):

```bash
cd server
# Point DATABASE_URL at Postgres, then:
npx prisma generate --schema=prisma/schema.postgresql.prisma
npx prisma db push --schema=prisma/schema.postgresql.prisma
NODE_ENV=production DATABASE_URL='postgresql://…' BOOTSTRAP_ADMIN_EMAIL=admin@your-org.com BOOTSTRAP_ADMIN_PASSWORD='…' node prisma/seed.js
```

Indexes on `note.fileId`, `attachment.fileId`, `approvalMatrix.fileId`, and `auditLog.createdAt` are in both schemas.

## 2. Environment

Copy `server/.env.example` to `server/.env` (or set the same keys on the host):

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Serves `dist/`, CSP, secure cookies, no `/api/demo-users` |
| `PORT` | Host bind port (or platform-assigned) |
| `JWT_SECRET` | Required in production |
| `CLIENT_ORIGIN` | Browser origin for CORS + sockets |
| `DATABASE_URL` | `file:./dev.db` or a Postgres URL |
| `BOOTSTRAP_ADMIN_*` | First SUPERADMIN when seeding in production |
| `COOKIE_SAMESITE=none` | Only if the SPA is on a different origin (then HTTPS is required) |
| `TRUST_PROXY=1` | Behind Railway / Render / nginx |

Same-origin Option A does not need a CSRF token. Add one only if you split the SPA onto a second origin.

**Required for production:** `CLIENT_ORIGIN` must be the public site URL (for example `https://dms.your-org.com`). Localhost origins are not allowed when `NODE_ENV=production`.

**PostgreSQL:** after setting a `postgresql://` URL, generate the client from the Postgres schema *before* start:

```bash
npx prisma generate --schema=prisma/schema.postgresql.prisma
npx prisma db push --schema=prisma/schema.postgresql.prisma
```

Do not point `DATABASE_URL` at Postgres while the default SQLite Prisma client is still generated.

## 3. Start

```bash
NODE_ENV=production npm start --prefix server
```

Health check: `GET /api/health` (and `GET /health`) returns `{ ok, db, ts }`.

Preflight: `npm run deploy:check` after `npm run build`.

## 4. Option B (decoupled)

- Frontend: `VITE_API_URL=https://api.example.com/api`, `COOKIE_SAMESITE=none`
- API: `CLIENT_ORIGIN=https://app.example.com`
- Multi-instance: put a Redis-backed limiter in front of `/api/auth/login` (in-memory store is per process only)

## 5. Render

Web Service from the GitHub repo. **Root Directory** empty (repo root).

| Setting | Value |
| --- | --- |
| Build Command | `npm run render-build` |
| Start Command | `npm start` |
| Node | 20 |

Required env: `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL` (Render Postgres Internal Database URL), `CLIENT_ORIGIN=https://YOUR-SERVICE.onrender.com`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`, `TRUST_PROXY=1`.

## 6. CI

`.github/workflows/e2e.yml` installs Chrome, pushes SQLite, starts API + Vite preview, and runs `npm run test:e2e`.
