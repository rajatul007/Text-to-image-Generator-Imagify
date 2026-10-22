# Production readiness checklist

## Infrastructure
- [ ] PostgreSQL with automated backups / point-in-time recovery; restore tested
- [ ] `npm run db:deploy` runs in the release pipeline before the new version starts
- [ ] `APP_URL` is the final `https://` origin (enables `Secure` + `__Host-` cookies)
- [ ] `AUTH_SECRET` is long and random; secrets stored in the platform's secret manager, not in the repo
- [ ] `STORAGE_DRIVER=s3` with a **private** bucket (public access blocked), versioning or replication enabled
- [ ] `REDIS_URL` set (shared rate limits across instances)
- [ ] `JOB_RUNNER=worker` and at least one `npm run worker` process supervised (systemd/PM2/container restart policy)
- [ ] HTTPS terminator / CDN in front; request body limit ≥ 12 MB for uploads
- [ ] Log shipping for stdout JSON logs; alerting on `level:"error"` and on failed webhooks

## Integrations
- [ ] At least one image provider key set; one real generation per enabled model succeeds
- [ ] Unused models disabled in Admin → Configuration; credit costs reviewed against provider prices
- [ ] `LLM_API_KEY` set and the enhancer tested (or accept that the button explains it's unavailable)
- [ ] Email provider configured with a verified sending domain (SPF, DKIM, DMARC); verification and reset emails received
- [ ] Google OAuth consent screen published; redirect URI = `${APP_URL}/api/auth/google/callback`
- [ ] Optional: `OPENAI_MODERATION=true`

## Payments
- [ ] Razorpay account activated (KYC) for live mode
- [ ] Live keys + live webhook (`/api/webhooks/razorpay`) with all events listed in the README; webhook secret set
- [ ] Auto-capture enabled
- [ ] One real low-value purchase → credits added → refund → credits reversed, verified in Admin → Payments
- [ ] If offering subscriptions: plans created in Razorpay, ids saved in Admin → Configuration, one test cycle observed
- [ ] Prices, GST treatment and receipts reviewed with your accountant

## Product & legal
- [ ] Privacy policy, terms and refund policy reviewed by counsel (current pages are templates)
- [ ] Support email set (`SUPPORT_EMAIL`) and monitored
- [ ] Welcome credits, low-credit threshold, report auto-hide threshold configured
- [ ] Admin account(s) promoted with `npm run admin:promote`, 2+ admins for coverage
- [ ] Moderation process: someone reviews Admin → Reports daily
- [ ] Optional: `npx tsx scripts/generate-showcase.ts` to seed the public gallery with real images

## Verification
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` pass in CI
- [ ] Smoke test on staging with production-like config (S3, Redis, worker, real email, Razorpay test mode)
- [ ] Mobile check on a real phone: generate, before/after slider, checkout
