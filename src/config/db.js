import mongoose from "mongoose";
import config from "./index.js";
import logger from "./logger.js";

export async function connectDB(uri = config.mongoUri) {
  const opts = {
    // mongoose 7 defaults are fine
  };

  try {
    await mongoose.connect(uri, opts);
    logger.info("✅ MongoDB connected");
  } catch (err) {
    logger.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}
