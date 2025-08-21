FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY packages/shared/src/mocks/openai/package.json ./

# No dependencies to install since the mock service uses pre-built JS

# Copy pre-built source code
COPY packages/shared/dist ./dist/

# Create standalone server script
COPY packages/shared/src/mocks/openai/server.js ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/v1/models || exit 1

CMD ["node", "server.js"]