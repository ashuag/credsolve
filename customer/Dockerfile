# ── Stage 1: Install dependencies ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── Stage 2: Build ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config must have: output: 'standalone'
ENV NEXT_TELEMETRY_DISABLED=1
# Cache mount persists Next's webpack/SWC build cache across builds — cuts
# rebuild time significantly when only a few files changed.
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ── Stage 3: Production runtime ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Ownership is set per-COPY (--chown) rather than a trailing `chown -R /app`,
# which would rewrite the whole standalone output into one large new layer
# on every build.
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appuser /app/public ./public

USER appuser

EXPOSE 3011

ENV PORT=3011
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
