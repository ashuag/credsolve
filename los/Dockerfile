FROM node:20.19-alpine
WORKDIR /workspace/los
COPY los/package.json los/package-lock.json ./
COPY docker/entrypoint-dev.sh /entrypoint-dev.sh
RUN chmod +x /entrypoint-dev.sh
RUN npm ci
EXPOSE 3000
ENTRYPOINT ["/entrypoint-dev.sh"]
CMD ["npm", "run", "dev"]
