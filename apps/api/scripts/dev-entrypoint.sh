#!/bin/sh
# =============================================================================
# RomaneioHub API - Development Entrypoint
# =============================================================================
# Startup sequence:
#   1. Wait for PostgreSQL to be ready
#   2. Run Prisma migrations (migrate deploy)
#   3. Seed the database
#   4. Start NestJS dev server with hot-reload
# =============================================================================

set -e

echo "🚀 RomaneioHub API - Development Startup"
echo "========================================="

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db execute --schema=./packages/db/prisma/schema.prisma --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES - PostgreSQL not ready, retrying in 2s..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ PostgreSQL failed to become ready after $MAX_RETRIES attempts"
  exit 1
fi

# Run Prisma migrations
echo ""
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
echo "✅ Migrations applied successfully!"

# Seed the database
echo ""
echo "🌱 Seeding database..."
cd packages/db && npx tsx prisma/seed.ts && cd /app
echo "✅ Database seeded successfully!"

# Start the NestJS dev server with hot-reload
echo ""
echo "🔥 Starting NestJS dev server with hot-reload..."
exec npm run dev --workspace=@romaneio-hub/api
