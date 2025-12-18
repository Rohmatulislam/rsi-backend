#!/bin/sh

echo "--- STARTING TAILSCALE ---"
# Jalankan tailscaled di background
# Memberikan izin SOCKS5 di port 1055
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Tunggu agar tailscaled siap
sleep 5

# Hubungkan ke jaringan Tailscale menggunakan Auth Key jika ada
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
    echo "Connecting to Tailscale..."
    tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=rsi-backend-cloud --accept-routes
    
    # Tunggu koneksi stabil
    sleep 5
    
    # Diagnostik: Cek status Tailscale
    echo "Tailscale Status:"
    tailscale status
    
    # Jembatan lokal (socat): Menggunakan SOCKS4A (lebih kompatibel dengan tailscaled)
    # Menghubungkan localhost:3307 -> 100.73.168.57:3306
    echo "Starting socat bridge: localhost:3307 -> 100.73.168.57:3306 (via SOCKS4A:1055)"
    socat TCP-LISTEN:3307,fork,reuseaddr SOCKS4A:127.0.0.1:100.73.168.57:3306,socksport=1055 &
    
    # Tunggu sebentar agar socat siap
    sleep 2
fi

# Jalankan migrasi database
echo "--- RUNNING PRISMA MIGRATIONS ---"
# Generate client dulu untuk memastikan schema terbaru
npx prisma generate
# Paksa jalankan migrasi deploy
npx prisma migrate deploy || echo "Migration failed, check DATABASE_URL"

# Jalankan aplikasi utama
echo "--- STARTING NESTJS APP ---"
exec npm run start:prod
