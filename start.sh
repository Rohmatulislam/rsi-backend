#!/bin/sh

# Jalankan tailscaled di background
# --tun=userspace-networking diperlukan karena container tidak punya akses /dev/net/tun di Railway
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Tunggu sebentar agar tailscaled siap
sleep 5

# Hubungkan ke jaringan Tailscale menggunakan Auth Key jika ada
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
    echo "Connecting to Tailscale..."
    tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=rsi-backend-cloud
fi

# Jalankan migrasi database
echo "Running database migrations..."
npx prisma migrate deploy

# Jalankan aplikasi utama
echo "Starting application..."
exec npm run start:prod
