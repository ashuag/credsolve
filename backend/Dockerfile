# syntax=docker/dockerfile:1

# ── Stage 1: Build ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Native build tools for @tensorflow/tfjs-node (face-api Aadhaar↔selfie match) and bcrypt.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    make \
    g++ \
    ca-certificates

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
ENV DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy"
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate --config prisma.config.ts
RUN npm run build

# Strip devDependencies in place instead of a second `npm ci --omit=dev` —
# avoids rebuilding native modules (tfjs-node, bcrypt) a second time.
RUN npm prune --omit=dev

# ── Stage 3: Production runtime ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Chromium + fonts for PDF generation; libstdc++ for tfjs-node / face-api.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-indic \
    ca-certificates \
    libstdc++6

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Ownership is set per-COPY (--chown) rather than a trailing `chown -R /app`,
# which would rewrite the whole node_modules tree (~1.4GB) into one huge new
# layer on every build and roughly double image export time.

# Copy production dependencies (includes @tensorflow/tfjs-node + @vladmandic/face-api models)
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules

# Copy built app (output is build/, not dist/)
COPY --from=builder --chown=appuser:appuser /app/build ./build
COPY --from=builder --chown=appuser:appuser /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appuser /app/prisma ./prisma
COPY --from=builder --chown=appuser:appuser /app/prisma.config.ts ./
COPY --from=builder --chown=appuser:appuser /app/package.json ./

# Copy assets (loan document templates, etc.)
COPY --from=builder --chown=appuser:appuser /app/assets ./assets

USER appuser

EXPOSE 4001

# Migrate → start.
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma.config.ts && node build/src/main.js"]