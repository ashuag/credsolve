FROM node:22-alpine

WORKDIR /workspace/los

COPY los/package*.json ./
COPY docker/entrypoint-dev.sh /entrypoint-dev.sh

RUN chmod +x /entrypoint-dev.sh && npm ci

EXPOSE 3000

ENTRYPOINT ["/entrypoint-dev.sh"]
CMD ["npm", "run", "dev"]