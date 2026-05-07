const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const connectPostgres = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL via Prisma");
  } catch (error) {
    console.error("❌ PostgreSQL Connection Failed:", error.message);
    // Unlike Mongo, we might not want to kill the whole process 
    // if the rest of the app relies on Mongo.
  }
};

module.exports = { prisma, connectPostgres };