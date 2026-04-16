FROM node:20.19-alpine
WORKDIR /workspace/customer
COPY customer/package.json customer/package-lock.json ./
COPY docker/entrypoint-dev.sh /entrypoint-dev.sh
RUN chmod +x /entrypoint-dev.sh
RUN npm ci
EXPOSE 3001
ENTRYPOINT ["/entrypoint-dev.sh"]
CMD ["npm", "run", "dev"]
