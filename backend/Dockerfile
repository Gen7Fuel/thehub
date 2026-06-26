FROM node:23-alpine

# 1. Install curl, chromium, and necessary system library dependencies for headless execution
RUN apk add --no-cache \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 2. Tell Playwright to skip downloading extra browsers during npm ci
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package*.json ./

# 3. Securely leverage your mount cache for lightning-fast builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .

CMD ["npm", "start"]