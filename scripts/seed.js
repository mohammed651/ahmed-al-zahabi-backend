import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../src/config/index.js";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function seed() {
  await connectDB(config.mongoUri);
  const existing = await User.findOne({ username: config.adminUser });
  if (existing) {
    console.log("Admin موجود مسبقًا:", config.adminUser);
    process.exit(0);
  }
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(config.adminPass, salt);
  const admin = await User.create({ name: "Admin", username: config.adminUser, passwordHash: hash, role: "admin" });
  console.log("Admin created:", admin.username);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
