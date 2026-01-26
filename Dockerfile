# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and configs
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Generate Prisma Client
# Set DATABASE_URL as env var for prisma.config.ts
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
RUN npx prisma generate

# Build application
RUN npm run build

# Production Stage
FROM node:20-slim AS runner

WORKDIR /app

# Install tailscale, curl, and socat
RUN apt-get update && apt-get install -y curl gnupg socat && \
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
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/start.sh ./start.sh

# Setup start script
RUN chmod +x start.sh

# Expose port (Railway uses 8080 by default)
EXPOSE 8080

# Start with tailscale
CMD ["./start.sh"]
