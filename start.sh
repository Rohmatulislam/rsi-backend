#!/bin/sh

# Jalankan tailscaled di background
# --tun=userspace-networking diperlukan karena container tidak punya akses /dev/net/tun di Railway
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Tunggu sebentar agar tailscaled siap
sleep 2

# Hubungkan ke jaringan Tailscale menggunakan Auth Key
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
    tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=rsi-backend-cloud
fi

# Jalankan aplikasi utama
exec npm run start:prod
