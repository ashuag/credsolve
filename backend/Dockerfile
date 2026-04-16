FROM node:20-alpine

WORKDIR /workspace/backend

# Only copy package files (better caching)
COPY backend/package*.json ./

RUN npm install --no-audit --no-fund

# Do NOT copy full source (volume will handle it)

EXPOSE 4000

CMD ["npm", "run", "dev"]