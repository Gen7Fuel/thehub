# Use Node.js official image as base
FROM node:23-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy all source files into the container
COPY . .

# Command to run the app
CMD ["node", "index.js"]
