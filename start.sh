#!/bin/sh

# Jalankan persiapan database
echo "--- PREPARING DATABASE SCHEMA ---"
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set."
else
    # Export secara eksplisit agar prisma bisa baca
    export DATABASE_URL="$DATABASE_URL"
    npx prisma generate
    echo "Forcing schema sync with db push..."
    npx prisma db push --accept-data-loss
fi

# Jalankan aplikasi utama
echo "--- STARTING NESTJS APP ---"
# Port dari environment atau default 2005
export PORT=${PORT:-2005}
exec npm run start:prod
