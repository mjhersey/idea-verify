FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/shared/package.json ./
COPY packages/shared/package-lock.json* ./

# Install dependencies  
RUN npm ci --only=production

# Copy source code
COPY packages/shared/dist ./dist/

# Create standalone server script
COPY packages/shared/src/mocks/anthropic/server.js ./

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["node", "server.js"]