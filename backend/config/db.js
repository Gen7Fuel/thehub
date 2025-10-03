const mongoose = require("mongoose");

/**
 * connectDB
 * Asynchronously connects to the MongoDB database using the connection string
 * specified in the MONGO_URI environment variable.
 * Logs a success message on connection, or exits the process on failure.
 */
const connectDB = async () => {
  try {
    // Connect to MongoDB with recommended options
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`Connected to ${process.env.MONGO_URI}`);
  } catch (error) {
    // Log error and exit process if connection fails
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;