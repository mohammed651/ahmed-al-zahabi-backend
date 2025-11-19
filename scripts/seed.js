// scripts/seed.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../src/config/index.js";
import { connectDB } from "../src/config/db.js";

import User from "../src/models/User.js";
import Branch from "../src/models/Branch.js";

async function seed() {
  await connectDB(config.mongoUri);

  console.log("🚀 Running seed script...");

  // ---------------------------------------
  // 1) SEED BRANCHES with `code`
  // ---------------------------------------
  const fixedBranches = [
    { name: "الدور الأول", type: "showroom", code: "floor1" },
    { name: "الدور الثاني", type: "showroom", code: "floor2" },
    { name: "المخزن", type: "warehouse", code: "warehouse" }
  ];

  for (const br of fixedBranches) {
    const existsByName = await Branch.findOne({ name: br.name });
    const existsByCode = await Branch.findOne({ code: br.code });

    if (!existsByName && !existsByCode) {
      await Branch.create(br);
      console.log(`✔ تم إنشاء الفرع: ${br.name} (code: ${br.code})`);
      continue;
    }

    // إذا الفرع موجود بالاسم لكن ماعهوش code — حدّثه (migration بسيط)
    if (existsByName && !existsByName.code) {
      // إذا الكود مستخدم مسبقًا لفرع آخر، نحاول تجاهل التحديث
      const conflict = await Branch.findOne({ code: br.code });
      if (!conflict) {
        existsByName.code = br.code;
        await existsByName.save();
        console.log(`↺ حدّثنا الفرع ${br.name} وأضافنا code: ${br.code}`);
      } else {
        console.log(`⚠ لا يمكن إضافة code ${br.code} للفرع ${br.name} لأن الكود مستخدم`);
      }
      continue;
    }

    console.log(`✔ الفرع موجود مسبقًا: ${br.name} (code: ${existsByCode ? existsByCode.code : existsByName.code})`);
  }

  // ---------------------------------------
  // 2) SEED ADMIN USER
  // ---------------------------------------
  const existing = await User.findOne({ username: config.adminUser });

  if (existing) {
    console.log("✔ Admin موجود مسبقًا:", config.adminUser);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(config.adminPass, salt);

  const admin = await User.create({
    name: "Admin",
    username: config.adminUser,
    passwordHash: hash,
    role: "admin",
    branch: null // ⚠️ ADMIN WITHOUT BRANCH
  });

  console.log("✔ Admin created:", admin.username);

  process.exit(0);
}

seed().catch(e => {
  console.error("❌ Seed Error:", e);
  process.exit(1);
});
