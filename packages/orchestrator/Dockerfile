# Multi-stage build for Orchestrator service
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
COPY package*.json ./
COPY packages/orchestrator/package*.json ./packages/orchestrator/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY packages/orchestrator/src ./packages/orchestrator/src
COPY packages/orchestrator/tsconfig.json ./packages/orchestrator/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Build the application
RUN npm run build --workspace=@ai-validation/shared
RUN npm run build --workspace=@ai-validation/orchestrator

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY packages/orchestrator/package*.json ./packages/orchestrator/
COPY packages/shared/package*.json ./packages/shared/

# Install only production dependencies
RUN npm ci --only=production --workspace=@ai-validation/orchestrator --workspace=@ai-validation/shared

# Copy built application from builder stage
COPY --from=builder /app/packages/orchestrator/dist ./packages/orchestrator/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Change ownership to non-root user
RUN chown -R orchestrator:nodejs /app
USER orchestrator

# Expose port for health checks and API
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["node", "packages/orchestrator/dist/index.js"]