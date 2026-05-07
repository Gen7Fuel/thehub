// prisma.config.js
const { defineConfig } = require('@prisma/config');

// Manually load .env if process.env.DATABASE_URL is missing
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: './.env' });
}

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});