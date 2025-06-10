# Multi-stage build for Telegram Bot
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock --production && npm cache clean --force

# Development stage
FROM base AS development
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data
RUN mkdir -p /app/bot_data
RUN mkdir -p /app/logs

# Expose no ports (bot doesn't need to expose ports)

# Start development server
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 telegram-bot

# Copy built application
COPY --from=builder --chown=telegram-bot:nodejs /app/dist ./dist
COPY --from=builder --chown=telegram-bot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=telegram-bot:nodejs /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/data && chown telegram-bot:nodejs /app/data
RUN mkdir -p /app/bot_data && chown telegram-bot:nodejs /app/bot_data
RUN mkdir -p /app/logs && chown telegram-bot:nodejs /app/logs

USER telegram-bot

# Start production server
CMD ["node", "dist/index.js"] 