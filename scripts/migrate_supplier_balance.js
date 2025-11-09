// scripts/migrate_supplier_balance.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { });
  console.log("✅ Connected to MongoDB");

  const all = await Supplier.find();
  let count = 0;
  for (const s of all) {
    // if legacy fields exist (balance_type, balance_amount) convert them
    // some older docs might already not have them; skip if nothing to do
    if (s.balance_type || typeof s.balance_amount !== "undefined") {
      const amt = Number(s.balance_amount?.toString() || 0);
      if (s.balance_type === "gold") {
        s.balanceGrams = mongoose.Types.Decimal128.fromString(String(amt));
      } else {
        s.balanceCash = mongoose.Types.Decimal128.fromString(String(amt));
      }
      // remove legacy fields if they exist
      s.balance_type = undefined;
      s.balance_amount = undefined;
      await s.save();
      count++;
      console.log("migrated supplier", s._id.toString());
    }
  }

  console.log(`✅ Migration done. Updated ${count} suppliers.`);
  process.exit(0);
}

run().catch(e => { console.error("Migration failed:", e); process.exit(1); });
