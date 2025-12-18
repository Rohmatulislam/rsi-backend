# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Generate Prisma Client
# We provide a dummy DATABASE_URL because prisma generate needs it to satisfy the config
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate

# Build application
RUN npm run build

# Production Stage
FROM node:20-slim AS runner

WORKDIR /app

# Install tailscale and curl
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://tailscale.com/install.sh | sh && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh

# Setup start script
RUN chmod +x start.sh

# Expose port
EXPOSE 2000

# Start with tailscale
CMD ["./start.sh"]
