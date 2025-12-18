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
    
    # Jembatan lokal (socat): Menghubungkan localhost:3307 ke database RS melalui Tailscale SOCKS5
    echo "Starting socat bridge: localhost:3307 -> 100.73.168.57:3306 (via SOCKS5:1055)"
    # Menggunakan SOCKS5 karena tailscaled defaultnya SOCKS5
    socat TCP-LISTEN:3307,fork,reuseaddr SOCKS5:127.0.0.1:100.73.168.57:3306,socksport=1055 &
    
    # Tunggu sebentar agar socat siap
    sleep 2
    echo "Socat bridge is running in background."
fi

# Jalankan migrasi database
echo "--- RUNNING PRISMA MIGRATIONS ---"
npx prisma migrate deploy

# Jalankan aplikasi utama
echo "--- STARTING NESTJS APP ---"
exec npm run start:prod
