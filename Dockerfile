# ABOUTME: Multi-stage Dockerfile for HookRelay production deployment.
# ABOUTME: Builds frontend and backend, produces a minimal Node.js runtime image.

FROM node:22-slim AS base

# --- Build frontend ---
FROM base AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/
RUN cd frontend && npm install
COPY frontend/ frontend/
COPY tsconfig.json .
RUN ./frontend/node_modules/.bin/vite build --config frontend/vite.config.ts

# --- Build backend ---
FROM base AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json .
COPY src/ src/
RUN npx tsc

# --- Production deps only ---
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Production image ---
FROM base AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/package.json ./package.json
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY landing/ ./landing/

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=8080
ENV HOOKRELAY_DB_PATH=/data/hookrelay.db

EXPOSE 8080

CMD ["node", "dist/server.js"]
