# Multi-stage build for NestJS Backend  
FROM node:24-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock --production && npm cache clean --force

# Development stage
FROM base AS development
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start development server
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM base AS production
RUN apt-get update && apt-get install -y openssl libssl3 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads
RUN mkdir -p /app/logs && chown nestjs:nodejs /app/logs

USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start production server
CMD ["node", "dist/main"]
