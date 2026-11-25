FROM node:23-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY auth-backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline
COPY auth-backend/ ./
COPY backend/models/ ./models/
COPY backend/utils/attachSiteAlias.js ./utils/attachSiteAlias.js
CMD ["node", "app.js"]
