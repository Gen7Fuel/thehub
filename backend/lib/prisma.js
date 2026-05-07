const { PrismaClient } = require('@prisma/client');

// In Prisma 7, it will automatically look at your prisma.config.ts 
// but we pass the URL explicitly here to ensure it uses the .env value
const prisma = global.prisma || new PrismaClient({
  datasource: {
    url: process.env.DATABASE_URL
  }
});


/**
 * We check if HOST is NOT "VPS". 
 * If it's local development (no HOST variable), we store prisma on the global 
 * object to prevent nodemon from creating a new connection on every save.
 */
if (process.env.HOST !== 'VPS') {
  global.prisma = prisma;
}

module.exports = prisma;