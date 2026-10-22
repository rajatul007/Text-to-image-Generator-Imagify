# Text to Image Generator

A full-stack AI image-generation platform: text-to-image with real providers, an LLM prompt enhancer, a prompt library, seed control, an image editor with before/after comparison, a background job system with honest progress, a private gallery with public Explore and revocable share links, an immutable credit ledger, Razorpay payments and subscriptions, and an admin console.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI · PostgreSQL + Prisma 6 (Rust-free client, `pg` adapter) · Redis (optional) · Recharts · Vitest · Playwright**.

> This project replaces the original Vite + Express + MongoDB *Imagify* app. Its Clipdrop integration and Razorpay flow were carried over and rebuilt on the new stack (Clipdrop is one of four supported providers).

---

## Contents

1. [Quick start](#quick-start)
2. [What's included](#whats-included)
3. [Project structure](#project-structure)
4. [Configuration & integrations](#configuration--integrations)
5. [Database & migrations](#database--migrations)
6. [Background jobs](#background-jobs)
7. [Payments (Razorpay)](#payments-razorpay)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Security model](#security-model)
11. [Policies: credits, refunds, rollover](#policies)

Also see [`docs/API.md`](docs/API.md) and [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md).

---

## Quick start

Requirements: **Node.js ≥ 20.9**, **PostgreSQL ≥ 14**, optionally **Redis ≥ 6**.

```bash
npm install
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET, and at least one provider key
npm run db:deploy               # apply migrations (prisma migrate deploy)
npm run db:seed                 # models, credit packages, plans, 45 prompt templates, defaults
npm run dev                     # http://localhost:3000
```

Create your account at `/signup`. With `EMAIL_PROVIDER=console` the verification link is printed in the server log (and stored in the `EmailLog` table, dev only). Then make yourself an administrator:

```bash
npm run admin:promote -- you@example.com
```

Admin rights can only be granted this way — never through signup or any API.

**Fill the homepage gallery with real images (optional):** once a provider key is set,

```bash
npx tsx scripts/generate-showcase.ts flux-schnell 8
```

generates the featured library prompts through the normal pipeline under a "Showcase" account and publishes them. Until then the homepage shows prompt suggestions instead of fake artwork.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run worker` | Background generation worker (when `JOB_RUNNER=worker`) |
| `npm run db:deploy` / `db:migrate` / `db:seed` | Apply migrations / create a migration in dev / seed data |
| `npm run admin:promote -- <email>` | Promote a verified user to admin |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests (Vitest, real PostgreSQL) |
| `npm run test:e2e` | End-to-end tests (Playwright, production build) |

---

## What's included

| Area | Highlights |
| --- | --- |
| **Generation** | 6 text-to-image models across Stability AI, Replicate (FLUX), OpenAI (gpt-image-1) and Clipdrop. 12 styles, per-model aspect ratios, 1–4 images, quality tiers, negative prompts and seeds *only where the model supports them* (controls are disabled with an explanation otherwise). |
| **Prompt enhancer** | Real LLM call (OpenAI-compatible or Anthropic). Concise / detailed / cinematic / realistic / artistic modes, up to 3 alternatives, editable results, copy, apply, restore original. Original + enhanced prompts are stored. Errors never pretend success. |
| **Prompt library** | 45 curated prompts in 15 categories; search, category filters, trending / recent / featured, favorites, community prompts (toggle), "Use" loads it into the generator for editing. |
| **Seeds** | Server picks and stores a seed when none is given; image *n* uses `seed + n`. Seed, model version and all parameters are stored per job and per image. Copy / reuse / regenerate with same or new seed. |
| **Editor** | Upload (decoded + re-encoded server-side) or pick an image; edit with text, variations, upscale, remove background. Every result is a new version with lineage (`ImageVersion`); interactive before/after slider (mouse, touch, keyboard, full screen); download both. |
| **Jobs** | Queued → Processing → Saving → Completed / Failed / Cancelled. Indeterminate progress (no fake percentages). Timeouts, classified retries with backoff, stale-job recovery, cancel while queued, retry/regenerate, duplicate-submission protection, notifications. |
| **Library** | My Creations (grid/list, search, filters by date/style/model/type/visibility, sort, pagination, detail modal), Generation History, Favorites. History lives in PostgreSQL. |
| **Explore & sharing** | Private by default; public only when published; trending/recent/most liked; search; style filters; creator links; likes; reports with auto-hide threshold; share links with 192-bit tokens, prompt/name visibility, revoke, safe handling of deleted images. |
| **Credits** | Wallet + append-only ledger (DB trigger blocks UPDATE/DELETE, CHECK keeps balance ≥ 0). Atomic conditional deductions, idempotency keys on every movement, exactly-once refunds, welcome bonus on verification, low-credit alerts, admin adjustments with mandatory reasons. |
| **Payments** | Razorpay Orders + Checkout, signature verification, server-side payment status check, signed webhooks with event de-duplication, refunds with proportional credit reversal, receipts, pending/failed/cancelled states. Subscriptions with monthly allocation once per billing period, upgrade/downgrade at cycle end, cancel at period end, payment-failure handling. |
| **Admin** | Analytics (users, actives, generations, failure rates, credits issued/consumed, revenue, refunds, provider usage & estimated cost, daily + monthly charts), user search/suspend/reactivate/credits, generation log, payments + refunds + webhook inspector, prompt template CRUD, moderation queue, configuration (welcome credits, thresholds, model costs/enablement, packages, plans, announcements), error/audit/email logs. |
| **Account** | Email/password, email verification, forgot/reset password, Google OAuth (PKCE), profile + avatar, change/set password, sign out other devices, notification preferences, data export (JSON), account deletion. |

---

## Project structure

```
prisma/
  schema.prisma              # 30 models – users, jobs, images, versions, ledger, payments, …
  migrations/                # SQL migrations (+ ledger trigger and CHECK constraints)
  seed.ts
scripts/
  worker.ts                  # background job worker
  promote-admin.ts
  generate-showcase.ts
  migrate-offline.ts         # applies migrations with plain `pg` (air-gapped environments)
src/
  proxy.ts                   # edge gate for protected pages (Next 16 "proxy", formerly middleware)
  app/
    (marketing)/             # /, /explore, /image/[id], /share/[token], /pricing, legal pages
    (auth)/                  # /login, /signup, /forgot-password, /reset-password, /verify-email
    (app)/                   # dashboard & user pages (sidebar shell)
    admin/                   # admin console (separate shell, server-side role check)
    api/                     # route handlers – see docs/API.md
  components/                # ui/ primitives (Radix-based), feature components
  lib/
    ai/                      # provider adapters, registry, styles, LLM, enhancer, moderation
    auth/                    # passwords, sessions, Google OAuth, account flows
    credits/                 # ledger + pricing
    jobs/                    # job creation (atomic charge), processor (retries/refunds), runner
    payments/                # Razorpay client, orders, webhooks, subscriptions
    images/                  # access control, serializers, processing, management
    storage/                 # local + S3-compatible drivers
    email/ notifications.ts audit.ts rate-limit.ts settings.ts api.ts env.ts …
  data/                      # seed models, packages, plans, prompt templates
tests/                       # Vitest integration tests (real PostgreSQL)
e2e/                         # Playwright journey + test-only provider stub
```

---

## Configuration & integrations

All variables are documented in [`.env.example`](.env.example). The app validates them at startup (`src/lib/env.ts`). Integration status is visible in **Admin → Overview**.

### Image providers

A model is shown as available only when it's enabled in Admin **and** its provider key is set. Unconfigured models are listed but disabled, with an explanation.

| Provider | Env var | Models | Seeds | Negative prompt |
| --- | --- | --- | --- | --- |
| Stability AI ([platform.stability.ai](https://platform.stability.ai)) | `STABILITY_API_KEY` | Stable Image Core, SD 3.5 Large, Stable Image Ultra; img2img edit & variations; fast upscaler; background removal | ✓ | ✓ |
| Replicate ([replicate.com](https://replicate.com)) | `REPLICATE_API_TOKEN` | FLUX.1 [schnell] | ✓ | – |
| OpenAI ([platform.openai.com](https://platform.openai.com)) | `OPENAI_API_KEY` | gpt-image-1 generation, edits, variations (1:1, 3:2, 2:3; HD) | – | – |
| Clipdrop ([clipdrop.co/apis](https://clipdrop.co/apis)) | `CLIPDROP_API_KEY` | Text to image (1:1), reimagine, upscale, remove/replace background | – | – |

Credit costs, enablement, max images and version labels are editable in **Admin → Configuration**. Add new models by inserting `AiModel` rows (see `src/data/seed-models.ts`) or new providers by implementing `ImageProvider` in `src/lib/ai/providers/`.

### Prompt enhancer (LLM)

- OpenAI: `LLM_PROVIDER=openai`, `LLM_API_KEY=sk-…`, optional `LLM_MODEL=gpt-4o-mini`.
- Any OpenAI-compatible API (Groq, OpenRouter, Together, local vLLM): also set `LLM_API_BASE`.
- Anthropic: `LLM_PROVIDER=anthropic`, `LLM_API_KEY`, optional `LLM_MODEL`.

### Google OAuth

Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: `${APP_URL}/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. The button appears automatically. Accounts are linked by verified Google email.

### Storage

- `STORAGE_DRIVER=local` stores files under `LOCAL_STORAGE_DIR` — fine for development or a single server with a persistent disk.
- `STORAGE_DRIVER=s3` works with AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc. **Keep the bucket private** (block all public access). Files are only ever served through `/api/images/[id]/file` and `/api/share/[token]/file`, which check access on every request and then stream (local) or redirect to a 5-minute presigned URL (S3).

### Email

`EMAIL_PROVIDER=resend` (set `RESEND_API_KEY` and a verified `EMAIL_FROM` domain) or `smtp` (SES, Postmark, Mailgun, Gmail SMTP…). Every send is logged in `EmailLog` (visible under Admin → Logs → Email delivery). Delivery failures surface to the user where relevant (e.g. "couldn't send the verification email — resend").

### Redis

Optional. When `REDIS_URL` is set, rate limits are shared across instances. Without it they're per-process (fine for one server). Rate-limited actions: login (per IP and per email), signup, password reset, verification, enhancer, generation, uploads, reports, checkout, and all mutations.

---

## Database & migrations

```bash
npm run db:deploy       # production / CI: apply pending migrations
npm run db:migrate      # development: create a new migration after editing schema.prisma
npm run db:studio       # browse data
```

The initial migration also creates rules Prisma can't express:

- `CreditWallet.balance >= 0` CHECK constraint
- a trigger that rejects `UPDATE`/`DELETE` on `CreditTransaction` (append-only ledger)
- positivity checks on packages, orders and job credits

**Offline environments:** Prisma CLI downloads its schema engine on first use. Where that's blocked, apply the same SQL with `npx tsx scripts/migrate-offline.ts` — it records migrations in `_prisma_migrations`, so `prisma migrate deploy/status` stay compatible later. `prisma generate` needs no download because the client runs in Rust-free mode (`engineType = "client"` + `@prisma/adapter-pg`).

**Backups:** use your provider's automated backups / PITR (Neon, Supabase, RDS, Cloud SQL), or `pg_dump --format=custom "$DATABASE_URL" > backup.dump` on a schedule and test restores with `pg_restore --clean --dbname=...`. Back up object storage separately (bucket versioning/replication).

---

## Background jobs

Generations never block a request. `POST /api/generations` validates, computes the cost, creates the job and charges credits **in one transaction**, and returns immediately; the client polls `GET /api/generations/:id`.

- `JOB_RUNNER=inline` (default): processed inside the Next.js server process right after the response (`after()`), retries scheduled in-process, and a self-healing check re-dispatches stalled jobs on status polls. Good for one long-running `next start`.
- `JOB_RUNNER=worker` (recommended in production, required on serverless): run `npm run worker` (one or more instances). Jobs are claimed with an atomic conditional update, so workers never double-process.

Processing: provider call with timeout (`IMAGE_PROVIDER_TIMEOUT_MS`) → classified errors (transient/rate-limited/timeout are retried up to 3 attempts with backoff; content-filter/invalid/auth are not) → upload to storage + thumbnail → records + version lineage → notifications. Final failure marks the job FAILED and refunds once (`refund:job:<id>`). Workers that die mid-job are recovered after the timeout + 60 s.

Postgres is the queue (no extra infrastructure needed). Redis is used for rate limiting; you can swap in BullMQ later behind `dispatchJob()` if you need very high throughput.

---

## Payments (Razorpay)

### Test mode setup

1. Razorpay Dashboard → switch to **Test mode** → Settings → API Keys → generate. Set `RAZORPAY_KEY_ID=rzp_test_…`, `RAZORPAY_KEY_SECRET`.
2. Settings → Webhooks → add `${APP_URL}/api/webhooks/razorpay` with a secret (`RAZORPAY_WEBHOOK_SECRET`). Select events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.created`, and for subscriptions `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.updated`.
   For local development expose your server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000` or ngrok) and use that URL.
3. Ensure **auto-capture** is on (Settings → Payment capture) so authorized payments are captured.
4. Buy a pack at `/credits` using Razorpay's [test cards / UPI](https://razorpay.com/docs/payments/payments/test-card-upi-details/) (e.g. UPI `success@razorpay`). The success page waits for server confirmation.

### How it works

- `POST /api/checkout` creates a `PaymentOrder` and a Razorpay order using **database prices** (the browser only sends a package id).
- After Checkout, `POST /api/checkout/verify` checks `HMAC(order_id|payment_id)` **and** fetches the payment from Razorpay; only `captured` payments are fulfilled.
- Webhooks verify `X-Razorpay-Signature` over the raw body, are stored once per `x-razorpay-event-id`, and are idempotent. Browser verification and webhooks can race safely — credits are granted under the ledger key `purchase:order:<id>` exactly once. Failing webhooks return 5xx so Razorpay retries; they're visible in Admin → Payments → Webhook events.
- Refunds (issued from Admin → Payments or the Razorpay dashboard) are recorded once per refund id and reverse the proportional share of credits (never below zero).
- No card data or UPI PINs ever reach this server. Secrets are server-only.

### Subscriptions

Create monthly plans in Razorpay (Subscriptions → Plans) matching the prices in Admin → Configuration, then paste each `plan_…` id there (or set `RAZORPAY_PLAN_*` before seeding). Plans without an id show as "Coming soon". Monthly credits are allocated only from the signed `subscription.charged` webhook, keyed by subscription + period start. Subscriptions require the Subscriptions product to be enabled on your merchant account.

**Going live:** complete Razorpay KYC/activation, switch to live keys and a live webhook, and run one real low-value purchase and refund end-to-end before announcing payments. Real payments are **not** active until you do this.

---

## Testing

```bash
# Unit + integration (needs PostgreSQL; uses database pixelforge_test, recreated from migrations each run)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/pixelforge_test npm test

# End-to-end (needs a production build; uses database pixelforge_e2e)
npm run build
npm run test:e2e        # set PW_CHROMIUM_PATH if you use a system Chromium
```

Integration tests call the real route handlers against a real database. External HTTP (Stability, LLM, Razorpay) is replaced with in-test fetch doubles; the E2E run points the app's provider base URLs at a local stub server (`e2e/stub-providers.mjs`). **No test requires external credentials**, and no fake provider exists in application code.

Covered: authentication & sessions, CSRF, brute-force limits, email verification + welcome bonus, password reset, prompt enhancement (success + failure), job creation, stages and processing, seed persistence, retries/timeouts/refunds (exactly once), cancellation, stale-job recovery, credit deduction, insufficient balance, duplicate & concurrent requests, overdraft protection, ledger immutability, image privacy & ownership, Explore filtering, prompt/creator visibility, share links & revocation, reports & moderation, likes, uploads validation, editing lineage, admin access, adjustments & suspension, payment signatures, checkout verification, webhook signatures, duplicate webhooks, verify/webhook races, amount mismatches, refunds, subscription allocation, transaction history, data export and account deletion.

**Tests that need real credentials** (manual, before launch): one real generation per provider you enable, one enhancer call against your LLM, Google sign-in, a real email delivery, a Razorpay test-mode purchase/refund through the hosted Checkout with real webhooks, and a subscription test charge.

---

## Deployment

### Vercel (recommended for this repo)

1. **Import the repo:** [vercel.com/new](https://vercel.com/new) → *Import Git Repository* → `Text-to-image-Generator-Imagify`. Framework is detected as Next.js; keep the defaults. Vercel automatically runs the `vercel-build` script (migrations + seed + build).
2. **Before the first deploy, add environment variables** (Project → Settings → Environment Variables):
   - `AUTH_SECRET` – 32+ random characters (`openssl rand -base64 48`)
   - `ADMIN_EMAILS` – your email; it becomes admin after you sign up and verify it
   - at least one image provider key, e.g. `STABILITY_API_KEY` or `REPLICATE_API_TOKEN`
   - optional: `LLM_API_KEY`, `RAZORPAY_*`, `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, `GOOGLE_CLIENT_*`
3. **Add a database:** Project → *Storage* → *Create Database* → **Neon (Postgres)** → connect to the project. It sets `DATABASE_URL` (and an unpooled URL used for migrations).
4. **Add image storage:** Project → *Storage* → **Blob** → create and connect. It sets `BLOB_READ_WRITE_TOKEN`; images are stored as **private** blobs and served only through the app's access checks.
5. **Deploy** (Deployments → Redeploy if the first build ran before the database existed).
6. `APP_URL` is detected from your production domain automatically; set it explicitly if you add a custom domain.

Notes for Vercel: generation runs in the background of the request (`after()`, up to 300 s per request); retries and stalled jobs are resumed automatically while the page polls for status. Uploads are capped at 4 MB (Vercel's request limit). Without `EMAIL_PROVIDER=resend`, verification links appear in *Deployments → Logs*. For heavy traffic, run `npm run worker` on an always-on host with `JOB_RUNNER=worker`. Rate limits are per-instance unless you add Redis (e.g. Upstash, `REDIS_URL`).

### Render (alternative)

`render.yaml` defines a one-click Blueprint (web app + Postgres + disk): [render.com/deploy?repo=https://github.com/rajatul007/Text-to-image-Generator-Imagify](https://render.com/deploy?repo=https://github.com/rajatul007/Text-to-image-Generator-Imagify).

### Single VM / container

```bash
npm ci && npm run build && npm run db:deploy && npm run db:seed
JOB_RUNNER=worker npm start &       # web
JOB_RUNNER=worker npm run worker &  # worker (use systemd/PM2/supervisor in practice)
```

Put it behind HTTPS (Caddy/nginx) and set `APP_URL=https://…` (session cookies become `__Host-` + `Secure`). Use S3-compatible storage, Redis, and a transactional email provider.

**Docker:** a standard Node 20+ image running `npm ci && npm run build`, then `npm start` / `npm run worker` as two services sharing the same env.

---

## Security model

- Passwords: bcrypt (cost 12). Sessions: random 256-bit tokens, stored as SHA-256 hashes; `HttpOnly`, `SameSite=Lax`, `Secure` + `__Host-` prefix on HTTPS; 30-day sliding expiry; revoked on password change/reset and suspension.
- CSRF: all cookie-authenticated mutations require a same-origin `Origin`/`Referer`. Webhooks use HMAC instead.
- Authorization on the server for every request: ownership checks on jobs/images/ledger/orders, `role=ADMIN` checks on all admin pages and APIs, visibility checks on every image byte served. Private storage objects are never publicly addressable.
- Share tokens: 192-bit random, validated per request; revocation and deletion take effect immediately.
- Input validation with Zod everywhere; uploads decoded with sharp, re-encoded (strips EXIF/GPS), size- and pixel-limited.
- Credits: server-calculated costs, atomic conditional updates, idempotency keys, append-only ledger, non-negative balance at the DB level.
- Errors: user-safe messages only; internals go to structured logs and `ErrorLog`. Secrets are redacted from logs.
- Moderation: prompt blocklist (+ optional OpenAI moderation), provider safety filters, user reports with auto-hide, admin review.
- Audit log for admin actions: suspensions, credit adjustments, refunds, pricing/model/settings changes, prompt templates, moderation.
- Security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

---

## Policies

- **Generation costs** are per model and image (HD multiplies), shown before every request, configurable by admins.
- **Refunds of credits:** failed or cancelled-before-start jobs are refunded automatically, exactly once.
- **Credit expiry:** purchased, subscription and promotional credits **do not expire** and **roll over** month to month while the account is active.
- **Account deletion:** removes profile, images, prompts, sessions and social data; ledger and payment records are kept anonymised for accounting.
- Legal pages (`/privacy`, `/terms`, `/refund-policy`) are templates — have them reviewed before launch.
