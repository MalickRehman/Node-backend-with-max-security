# Production Dockerfile for Nexus UI Backend
# Multi-stage build for optimized image size

# Stage 1: Build stage
FROM node:25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Stage 2: Production stage
FROM node:25-alpine

# Install ClamAV for malware scanning
RUN apk add --no-cache \
    clamav \
    clamav-daemon \
    freshclam \
    && mkdir -p /var/log/clamav \
    && chown clamav:clamav /var/log/clamav

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application from builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env.example

# Create necessary directories
RUN mkdir -p logs uploads quarantine && \
    chown -R nodejs:nodejs logs uploads quarantine

# Update ClamAV virus definitions
RUN freshclam || true

# Start ClamAV daemon in background
COPY docker/clamd.conf /etc/clamav/clamd.conf
RUN chown clamav:clamav /etc/clamav/clamd.conf

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/app.js"]
