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
    
    # Debug: Tampilkan status Tailscale
    echo "--- TAILSCALE DEBUG INFO ---"
    echo "My Tailscale IP:"
    tailscale ip -4 || echo "Failed to get IP"
    echo ""
    echo "Tailscale Status:"
    tailscale status || echo "Failed to get status"
    echo "--- END DEBUG ---"
    
    # Tunggu sampai peer 100.73.168.57 bisa dijangkau (max 60 detik)
    echo "Waiting for Khanza peer (100.73.168.57) to be reachable..."
    PEER_IP="100.73.168.57"
    MAX_ATTEMPTS=12
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))
        echo "Ping attempt $ATTEMPT/$MAX_ATTEMPTS..."
        
        if tailscale ping $PEER_IP --timeout=5s 2>/dev/null; then
            echo "✅ Peer $PEER_IP is reachable!"
            break
        fi
        
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "⚠️ WARNING: Could not reach peer after $MAX_ATTEMPTS attempts."
            echo "Trying direct tailscale nc test..."
            echo "quit" | timeout 10 tailscale nc $PEER_IP 3306 && echo "✅ NC test succeeded!" || echo "❌ NC test failed"
        fi
        
        sleep 5
    done
    
    # Jembatan lokal (socat + tailscale nc):
    # Bind ke 0.0.0.0 agar bisa diakses dari Docker bridge network (172.17.0.1)
    echo "Starting tailscale bridge: 0.0.0.0:3307 -> 100.73.168.57:3306"
    socat TCP-LISTEN:3307,bind=0.0.0.0,fork,reuseaddr EXEC:"tailscale nc 100.73.168.57 3306" &
    SOCAT_PID=$!
    
    # Tunggu sebentar agar socat siap
    sleep 3
    
    # Test koneksi melalui socat bridge sebelum app dimulai
    echo "--- TESTING BRIDGE CONNECTION ---"
    MAX_BRIDGE_ATTEMPTS=10
    BRIDGE_ATTEMPT=0
    BRIDGE_READY=false
    
    while [ $BRIDGE_ATTEMPT -lt $MAX_BRIDGE_ATTEMPTS ]; do
        BRIDGE_ATTEMPT=$((BRIDGE_ATTEMPT + 1))
        echo "Bridge test attempt $BRIDGE_ATTEMPT/$MAX_BRIDGE_ATTEMPTS..."
        
        # Test koneksi ke socat bridge menggunakan nc
        if echo "" | timeout 10 nc -z 127.0.0.1 3307 2>/dev/null; then
            echo "✅ Bridge port 3307 is open!"
            # Double-check dengan tailscale nc langsung
            if echo "quit" | timeout 15 tailscale nc 100.73.168.57 3306 2>/dev/null; then
                echo "✅ MySQL connection through Tailscale verified!"
                BRIDGE_READY=true
                break
            fi
        fi
        
        echo "Waiting for bridge to be ready..."
        sleep 5
    done
    
    if [ "$BRIDGE_READY" = "true" ]; then
        echo "🎉 Bridge is ready! Proceeding to start app..."
    else
        echo "⚠️ Bridge test failed, but continuing anyway..."
    fi
fi




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
# Port otomatis dari Railway
export PORT=${PORT:-2000}
exec npm run start:prod
