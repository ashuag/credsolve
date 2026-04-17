FROM node:22-alpine

WORKDIR /workspace/backend

COPY backend/package*.json ./

RUN npm ci

EXPOSE 4001

CMD ["npm", "run", "dev"]