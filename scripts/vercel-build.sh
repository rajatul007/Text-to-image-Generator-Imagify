#!/bin/sh
# Vercel runs this automatically (package.json "vercel-build").
# Applies migrations + idempotent seed using the direct (non-pooled) connection when available, then builds.
set -e
[ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_URL" ] && export DATABASE_URL="$POSTGRES_URL"
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add a Postgres database (Vercel → Storage → Neon) and redeploy." >&2
  exit 1
fi
MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
DATABASE_URL="$MIGRATE_URL" npx tsx prisma/seed.ts
npm run build
