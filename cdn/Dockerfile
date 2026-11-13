FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .

CMD ["node", "index.js"]
