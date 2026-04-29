FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x docker-entrypoint.sh
RUN npm run compile

EXPOSE 8545

ENV HARDHAT_HOST=0.0.0.0 \
    HARDHAT_PORT=8545 \
    AUTO_DEPLOY_CONTRACT=true \
    DEPLOY_MAX_ATTEMPTS=30 \
    DEPLOY_RETRY_DELAY_SECONDS=2

ENTRYPOINT ["./docker-entrypoint.sh"]
