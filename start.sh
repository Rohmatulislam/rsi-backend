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
    
    # Tunggu sebentar agar koneksi stabil
    sleep 3
    
    # Jembatan lokal (socat): Menghubungkan localhost:3307 ke database RS melalui Tailscale
    # Kita menggunakan port 3307 agar tidak bentrok dengan MySQL standar jika ada
    echo "Starting socat bridge to 100.73.168.57:3306..."
    socat TCP-LISTEN:3307,fork,reuseaddr SOCKS4A:localhost:100.73.168.57:3306,socksport=1055 &
fi

# Jalankan migrasi database
echo "Running database migrations..."
npx prisma migrate deploy

# Jalankan aplikasi utama
echo "Starting application..."
exec npm run start:prod
