FROM node:22-alpine

WORKDIR /workspace/backend

COPY backend/package*.json ./

# Fail the image build if lockfile and dependencies drift (avoids empty node_modules in stale volumes).
RUN npm ci && node -e "require('nodemailer'); require('@nestjs/common')"

EXPOSE 4001

CMD ["npm", "run", "dev"]