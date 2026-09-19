# Multi-stage build for backend
FROM node:24-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    sqlite-dev \
    dumb-init

ENV NODE_ENV=production
ENV PORT=4000

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Create data directory
RUN mkdir -p /app/data

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]