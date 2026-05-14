FROM node:23-alpine
RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .

CMD ["npm", "start"]
