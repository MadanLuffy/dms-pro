# Document Management System — Production Scaling Plan (200+ Users)

**Date:** September 2026  
**Status:** Functional core complete · Needs infrastructure upgrade for production scale

---

## Executive Summary

The DMS Pro application is **fully functional** and passes all end-to-end tests for document workflows (login, file creation, noting, threaded replies, departmental approvals, CEO sign-off, audit logging). However, the current stack uses **SQLite + local file storage + single Node process**, which is suitable only for small teams (~10–20 users). To support **200+ users with persistent PDF storage**, we need to implement four infrastructure upgrades: PostgreSQL, Redis, S3 file storage, and a multi-instance deployment behind a load balancer.

---

## Current State

| Capability | Status |
|---|---|
| Core document workflow | ✅ Tested and passing |
| User authentication (JWT cookies) | ✅ Working |
| Department approval matrix | ✅ Working |
| File upload / download / streaming | ✅ Working (local disk) |
| PDF report generation | ✅ Working |
| Rate limiting | ✅ Configurable |
| End-to-end tests | ✅ 3 suites passing |

**Not ready for 200+ users without the changes below.**

---

## Why the Current Stack Doesn't Scale

| Problem | Impact at 200 Users |
|---|---|
| **SQLite database** | Write locks under concurrent load; single-writer bottleneck |
| **Local file storage** | Uploads lost on server restart/redeploy; not shared across instances |
| **Single Node process** | One crash = total system outage; no load distribution |
| **In-memory rate limits** | Won't work across multiple server instances |
| **In-memory socket state** | Users on instance A can't receive events from instance B |

---

## Target Architecture

```
                        ┌──────────────────┐
                        │  Cloudflare /    │
                        │  nginx (SSL +    │
                        │  Load Balancer)  │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
        ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
        │ Node #1   │    │ Node #2   │    │ Node #3   │
        │ (API +    │    │ (API +    │    │ (API +    │
        │  Socket)  │    │  Socket)  │    │  Socket)  │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Redis            │
                    │ (Rate limits +       │
                    │  Socket adapter)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PostgreSQL         │
                    │   (Managed, backup)  │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   AWS S3 / MinIO     │
                    │   (PDF uploads,      │
                    │    attachments)      │
                    └─────────────────────┘
```

---

## Four Infrastructure Upgrades Required

### 1. PostgreSQL (Replace SQLite)

**Why:** SQLite allows only one writer at a time. PostgreSQL handles hundreds of concurrent connections and supports proper row-level locking.

**What changes:** The schema already exists as `schema.postgresql.prisma`. We switch the Prisma client and `DATABASE_URL`.

**Estimated cost:** $15–50/month (managed: Render Postgres, Railway, AWS RDS)

**Implementation:**
- Update `DATABASE_URL` to point to Postgres instance
- Run: `prisma generate --schema=schema.postgresql.prisma`
- Run: `prisma db push --schema=schema.postgresql.prisma`
- Re-seed production data

---

### 2. Redis (Rate Limiting + Socket Adapter)

**Why:** With multiple Node instances, in-memory rate limits and socket state don't sync. Redis provides a shared store across all instances.

**What changes:**
- Replace in-memory `Map` buckets in `rateLimit.js` with Redis-backed store
- Add `@socket.io/redis-adapter` so socket events broadcast across all instances

**Estimated cost:** $10–25/month

**Implementation:**
- Add `RedisStore` for rate limiting (`rate-limit-redis` package)
- Add Redis adapter to Socket.io server
- Add `REDIS_URL` environment variable

---

### 3. S3 Object Storage (Persistent File Storage)

**Why:** Current uploads go to a local `uploads/` directory. On server restart, redeploy, or scale to multiple instances, all uploaded PDFs are lost. S3 provides durable, scalable storage.

**What changes:**
- Create an S3 client wrapper (`server/src/lib/s3.js`)
- Modify the multer upload middleware to upload directly to S3 instead of disk
- Update `streamUpload` controller to fetch from S3
- Keep local disk as fallback for development

**Estimated cost:** ~$0.023/GB/month (Standard-IA for infrequently accessed PDFs)

**Implementation:**
- Add AWS SDK dependencies (`@aws-sdk/client-s3`)
- Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` env vars
- Replace `fs.unlinkSync` / `fs.existsSync` calls with S3 `deleteObject` / `headObject`

---

### 4. Multi-Instance Deployment + SSL

**Why:** A single server process is a single point of failure. Three instances behind a load balancer ensure uptime and distribute the 200-user load.

**What changes:**
- Deploy 3× Node instances (Render Web Services, Railway, or Docker/Kubernetes)
- Add nginx or Cloudflare as reverse proxy (SSL termination + load balancing)
- Update `render.yaml` or create `docker-compose.yml`

**Estimated cost:** $30–90/month (3× compute instances) + $0 (Cloudflare free tier)

**Implementation:**
- Update `render.yaml` with 3 instances, Postgres, Redis, S3 env vars
- Or use Docker Compose for self-hosted deployment
- Configure Cloudflare SSL + proxy

---

## Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `server/src/lib/s3.js` | S3 client + upload/download/delete helpers |
| `server/src/lib/redis.js` | Redis client connection |
| `server/src/middleware/s3Upload.js` | Multer → S3 upload handler |

### Modified files
| File | Change |
|---|---|
| `server/src/middleware/upload.js` | Switch `UPLOAD_DIR` to S3 when configured |
| `server/src/middleware/rateLimit.js` | Replace Map buckets with Redis store |
| `server/src/sockets/index.js` | Add Redis adapter |
| `server/src/app.js` | Add health checks for Redis + S3 |
| `server/src/index.js` | Add connection startup for Redis/S3 |
| `server/prisma/schema.postgresql.prisma` | Point to new Postgres instance |
| `render.yaml` | Add 3 instances, Redis, S3, Postgres config |

---

## Estimated Timeline

| Phase | Task | Duration |
|---|---|---|
| **Phase 1** | Provision infrastructure (Postgres, Redis, S3 bucket) | 1 day |
| **Phase 2** | Implement S3 storage layer + modify upload middleware | 2 days |
| **Phase 3** | Switch rate limiting + socket.io to Redis | 1 day |
| **Phase 4** | Migrate database to Postgres | 1 day |
| **Phase 5** | Multi-instance deployment + SSL + load balancer | 1 day |
| **Phase 6** | Load testing + backup strategy + monitoring | 1–2 days |
| **Total** | | **~7–8 days** |

---

## Estimated Monthly Cost (200+ Users)

| Service | Cost |
|---|---|
| PostgreSQL (managed, 2GB) | $15–30 |
| Redis (Upstash/Elasticache) | $10–20 |
| S3 storage (~50GB PDFs) | $2 |
| 3× Compute instances | $45–90 |
| Cloudflare SSL + DNS | Free |
| **Total** | **~$70–150/month** |

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Data loss during migration | Run PostgreSQL and SQLite in parallel; migrate incrementally |
| S3 outage | S3 has 99.99% availability SLA; add retry logic |
| Redis outage | Rate limiting degrades gracefully (fallback to allow-all); Socket.io works without adapter |
| Cost overrun | Start with 1 instance; scale horizontally only when load tests confirm need |
| PDF file corruption | S3 versioning + integrity checks on upload |

---

## Pre-Deployment Checklist

- [ ] Provision managed PostgreSQL instance
- [ ] Provision Redis instance
- [ ] Create S3 bucket + IAM credentials
- [ ] Purchase/register domain, configure Cloudflare
- [ ] Implement S3 upload/download code
- [ ] Switch rate limiting to Redis
- [ ] Add Socket.io Redis adapter
- [ ] Migrate database to PostgreSQL
- [ ] Deploy 3 instances behind load balancer
- [ ] Configure SSL certificates
- [ ] Set up automated DB backups (daily)
- [ ] Set up S3 lifecycle policies (move old PDFs to Glacier after 90 days)
- [ ] Run load test with 200+ concurrent users
- [ ] Configure monitoring/alerting (UptimeRobot, LogRocket, or Datadog)

---

## Conclusion

The application codebase is **production-quality** at its core — authentication, authorization, document workflows, and approvals all work correctly. The remaining work is infrastructure: moving from a single-server SQLite setup to a scalable cloud architecture with PostgreSQL, Redis, S3, and load-balanced instances. Estimated **7–8 days of development** and **~$70–150/month** in cloud costs will make the system ready for 200+ users with persistent PDF storage.

---

**Prepared by:** DMS Pro Engineering  
**Contact:** For questions on any phase above
