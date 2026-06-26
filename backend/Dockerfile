# ── Stage 1: Install dependencies ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Build ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate --config prisma.config.ts
RUN npm run build

# ── Stage 3: Production runtime ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install Chromium + fonts for PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-indic \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built app (output is build/, not dist/)
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./

# Copy assets (loan document templates, etc.)
COPY --from=builder /app/assets ./assets

# Own everything by appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 4001

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma.config.ts && node build/src/main.js"]
