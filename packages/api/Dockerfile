# Multi-stage build for API service
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY packages/api/src ./packages/api/src
COPY packages/api/prisma ./packages/api/prisma
COPY packages/api/tsconfig.json ./packages/api/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Build the application
RUN npm run build --workspace=@ai-validation/shared
RUN npm run build --workspace=@ai-validation/api

# Generate Prisma client
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/

# Install only production dependencies
RUN npm ci --only=production --workspace=@ai-validation/api --workspace=@ai-validation/shared

# Copy built application from builder stage
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/packages/api/src/generated ./packages/api/src/generated

# Copy database migration script
COPY packages/api/src/database/migrations.ts ./packages/api/src/database/

# Change ownership to non-root user
RUN chown -R api:nodejs /app
USER api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "packages/api/dist/server.js"]