#!/bin/sh

echo "--- STARTING TAILSCALE ---"
# Jalankan tailscaled di background
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
    
    # Jembatan lokal (socat + tailscale nc):
    # Ini metode paling stabil. Menghubungkan localhost:3307 langsung ke jaringan Tailscale
    echo "Starting tailscale bridge: localhost:3307 -> 100.73.168.57:3306"
    socat TCP-LISTEN:3307,fork,reuseaddr EXEC:"tailscale nc 100.73.168.57 3306" &
    
    # Tunggu sebentar agar socat siap
    sleep 2
    echo "Bridge is ready."
fi

# Jalankan persiapan database
echo "--- PREPARING DATABASE SCHEMA ---"
npx prisma generate
echo "Forcing schema sync with db push..."
npx prisma db push --accept-data-loss

# Jalankan aplikasi utama
echo "--- STARTING NESTJS APP ---"
exec npm run start:prod
