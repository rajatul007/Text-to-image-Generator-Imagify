# Text to Image Generator – HTTP API

All endpoints are Next.js route handlers under `/api`. Requests and responses are JSON unless noted.

**Authentication** uses the `pf_session` cookie (`__Host-pf_session` on HTTPS) set by login/signup/Google OAuth.
**CSRF:** every cookie-authenticated `POST/PATCH/DELETE` must come from the same origin (`Origin` or `Referer` header).
**Errors** have the shape `{ "error": { "code": "…", "message": "user-safe text", "fields"?: { field: message }, "details"?: … } }` with a matching HTTP status:

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION` | 422 | Invalid input (`fields` lists problems) |
| `UNAUTHENTICATED` | 401 | Not signed in / bad credentials |
| `FORBIDDEN`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED` | 403 | Not allowed |
| `NOT_FOUND` | 404 | Missing **or not yours** (ownership failures are 404 to avoid leaking existence) |
| `CONFLICT` | 409 | State conflict (e.g. cancelling a running job) |
| `INSUFFICIENT_CREDITS` | 402 | Balance too low (`details.required`, `details.balance`) |
| `RATE_LIMITED` | 429 | Too many requests (`Retry-After` header) |
| `PROVIDER_UNAVAILABLE`, `NOT_CONFIGURED` | 503 | AI/payment provider down or not configured |
| `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA` | 413 / 415 | Upload problems |

Legend: 🔓 public · 👤 signed in · ✅ verified email required · 🛡 admin

## Authentication

| Method & path | Auth | Body / query | Notes |
| --- | --- | --- | --- |
| `POST /api/auth/signup` | 🔓 | `{ name, email, password }` | Creates user + session, sends verification email. Rate limited per IP. |
| `POST /api/auth/login` | 🔓 | `{ email, password }` | Rate limited per IP and per email. |
| `POST /api/auth/logout` | 👤 | – | Deletes the session. |
| `POST /api/auth/verify-email` | 🔓 | `{ token }` | Single-use; grants welcome credits once. |
| `POST /api/auth/resend-verification` | 👤 | – | |
| `POST /api/auth/forgot-password` | 🔓 | `{ email }` | Always the same response. |
| `POST /api/auth/reset-password` | 🔓 | `{ token, password }` | Single-use, 1 h expiry, signs out all sessions. |
| `GET /api/auth/google` → `/api/auth/google/callback` | 🔓 | `?next=/path` | OAuth 2.0 + PKCE + state. |
| `GET /api/auth/me` | 🔓 | – | `{ user, balance, unreadNotifications }` or `{ user: null }`. |

## Profile & account

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET/PATCH /api/profile` | 👤 | name, displayName, username, bio, notification prefs, publishing defaults |
| `POST/DELETE /api/profile/avatar` | 👤 | multipart `file` (PNG/JPEG/WebP ≤ 5 MB) |
| `GET /api/avatar/:userId` | 🔓 | public avatar |
| `POST /api/account/password` | 👤 | `{ currentPassword?, newPassword }` – signs out other sessions |
| `GET/DELETE /api/account/sessions` | 👤 | list / sign out other devices |
| `GET /api/account/export` | 👤 | JSON download of all personal data |
| `DELETE /api/account` | 👤 | `{ password?, confirm: "DELETE" }` |

## Models, prompts and generation

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/models` | 🔓 | models with capabilities & credit costs, styles, aspect ratios, `enhancerAvailable` |
| `POST /api/prompts/enhance` | 👤 | `{ prompt, mode: concise\|detailed\|cinematic\|realistic\|artistic, count: 1–4, style? }` → `{ id, prompts[], provider, model }` |
| `GET /api/prompts/library` | 🔓 | `?q&category&sort=trending\|recent\|featured&favorites=1&community=1&page` |
| `POST /api/prompts/library` | ✅ | share a community prompt (if enabled) |
| `POST/DELETE /api/prompts/library/:id/favorite` | 👤 | |
| `POST /api/prompts/library/:id/use` | 🔓 | usage counter (trending) |
| `POST /api/generations` | ✅ | see below → `{ job, duplicate, balance }` |
| `GET /api/generations` | 👤 | history: `?q&status&type&model&style&from&to&sort&page&pageSize` |
| `GET /api/generations/:id` | 👤 | job status + images (poll this) |
| `POST /api/generations/:id/cancel` | 👤 | only while `QUEUED`; refunds once |
| `POST /api/generations/:id/retry` | ✅ | `{ idempotencyKey, newSeed? }` – same settings (and seed unless `newSeed`) |
| `POST /api/edits` | ✅ | `{ sourceImageId, type: EDIT\|VARIATION\|UPSCALE\|REMOVE_BACKGROUND, modelId, prompt?, negativePrompt?, numImages?, strength?, seed?, idempotencyKey }` |
| `POST /api/uploads` | ✅ | multipart `file` → private source image for editing |

`POST /api/generations` body:

```json
{
  "modelId": "stability-core",
  "prompt": "a cat in space",
  "enhancedPrompt": "A highly detailed cinematic scene of …",
  "negativePrompt": "blurry",
  "style": "cinematic",
  "aspectRatio": "16:9",
  "quality": "standard",
  "numImages": 2,
  "seed": 4242,
  "idempotencyKey": "uuid-generated-by-the-client"
}
```

The cost is computed on the server (`creditsPerImage × hdMultiplier? × numImages`). Repeating a request with the same `idempotencyKey` returns the original job and never charges twice. Job `status` is one of `QUEUED, PROCESSING, UPLOADING, COMPLETED, FAILED, CANCELLED`. No percentage progress is reported because providers don't expose it.

## Images, Explore and sharing

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/images` | 👤 | own images: `?q&style&model&origin&visibility&favorites=1&from&to&sort&page` |
| `GET /api/images/:id` | 👤 owner | metadata, parent, root and version lineage |
| `PATCH /api/images/:id` | 👤 owner | `{ visibility?: PRIVATE\|PUBLIC, showPrompt?, showCreator? }` (publishing needs a verified email) |
| `DELETE /api/images/:id` | 👤 owner | deletes file, revokes share links |
| `GET /api/images/:id/file` | 🔓/👤 | `?variant=thumb&download=1` – bytes only if public or yours |
| `POST/DELETE /api/images/:id/favorite` | 👤 | |
| `POST/DELETE /api/images/:id/like` | 👤 | public images only |
| `POST /api/images/:id/report` | 👤 | `{ reason, details?, shareToken? }` |
| `POST /api/images/:id/share` | 👤 owner | `{ showPrompt, showCreator }` → `{ token, url }` |
| `DELETE /api/images/:id/share` | 👤 owner | revoke |
| `GET /api/share/:token/file` | 🔓 | `?variant=thumb&download=1` |
| `GET /api/explore` | 🔓 | `?q&style&model&creator&sort=trending\|recent\|top&page` |

## Credits, payments, subscriptions

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/credits` | 👤 | balance, lifetime totals, low-credit flag |
| `GET /api/credits/ledger` | 👤 | `?type&direction=in\|out&q&from&to&page` |
| `GET /api/credits/packages` | 🔓 | packages, plans, `paymentsEnabled`, `testMode` |
| `POST /api/checkout` | ✅ | `{ packageId }` → Razorpay Checkout options |
| `POST /api/checkout/verify` | 👤 | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` → `{ status: PAID\|PENDING\|FAILED }` |
| `POST /api/checkout/cancel` | 👤 | `{ orderId }` (modal dismissed) |
| `GET /api/checkout/:orderId` | 👤 | order status + balance |
| `POST /api/webhooks/razorpay` | HMAC | `X-Razorpay-Signature`, `X-Razorpay-Event-Id` |
| `GET/POST /api/subscriptions` | 👤 / ✅ | current subscription / start `{ planId }` |
| `POST /api/subscriptions/verify` | 👤 | `{ razorpay_subscription_id, razorpay_payment_id, razorpay_signature }` |
| `POST /api/subscriptions/change` | 👤 | `{ planId }` – at cycle end |
| `POST /api/subscriptions/cancel` | 👤 | at period end |

## Notifications

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/notifications` | 👤 | `?unread=1&page` |
| `POST /api/notifications/read` | 👤 | `{ ids: [] }` or `{ all: true }` |

## Admin (🛡 – every call checks `role = ADMIN` on the server; mutations are audit-logged)

| Method & path | Notes |
| --- | --- |
| `GET /api/admin/analytics` | users, generations, failure rates, credits, revenue, refunds, provider usage/cost, daily & monthly series |
| `GET /api/admin/users` · `GET /api/admin/users/:id` | search & detail (jobs, ledger, orders) |
| `PATCH /api/admin/users/:id` | `{ action: suspend\|reactivate, reason }` |
| `POST /api/admin/users/:id/credits` | `{ amount, kind: PROMOTIONAL\|ADMIN_ADJUSTMENT, reason, idempotencyKey }` |
| `GET /api/admin/generations` | `?status&provider&userId&page` |
| `GET /api/admin/payments` · `GET /api/admin/webhooks` | orders / webhook events |
| `POST /api/admin/payments/:id/refund` | `{ amountPaise, reason }` – refunds via Razorpay |
| `GET/POST /api/admin/prompts` · `PATCH/DELETE /api/admin/prompts/:id` | prompt templates |
| `GET/PATCH /api/admin/settings` | welcome credits, thresholds, limits, community prompts |
| `GET/POST /api/admin/packages` · `PATCH /api/admin/packages/:id` | credit packages |
| `PATCH /api/admin/plans/:id` | subscription plans (incl. Razorpay plan id) |
| `GET /api/admin/models` · `PATCH /api/admin/models/:id` | enable/disable, credit costs, limits |
| `GET /api/admin/reports` · `PATCH /api/admin/reports/:id` | `{ action: dismiss\|remove, note? }` |
| `GET/POST /api/admin/announcements` · `PATCH/DELETE /api/admin/announcements/:id` | |
| `GET /api/admin/logs` | `?kind=errors\|audit\|email` |
