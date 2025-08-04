# Multi-stage build for Web frontend
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
COPY package*.json ./
COPY packages/web/package*.json ./packages/web/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY packages/web/src ./packages/web/src
COPY packages/web/public ./packages/web/public
COPY packages/web/index.html ./packages/web/
COPY packages/web/vite.config.ts ./packages/web/
COPY packages/web/tsconfig.json ./packages/web/
COPY packages/web/tailwind.config.js ./packages/web/
COPY packages/web/postcss.config.js ./packages/web/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Build the shared package
RUN npm run build --workspace=@ai-validation/shared

# Build the web application
RUN npm run build --workspace=@ai-validation/web

# Production stage with Nginx
FROM nginx:alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001

# Copy built application from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY packages/web/nginx.conf /etc/nginx/nginx.conf

# Create nginx directories with proper permissions
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/cache/nginx/proxy_temp && \
    mkdir -p /var/cache/nginx/fastcgi_temp && \
    mkdir -p /var/cache/nginx/uwsgi_temp && \
    mkdir -p /var/cache/nginx/scgi_temp && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /etc/nginx

# Switch to non-root user
USER nginx-user

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]