// src/models/ScrapStore.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const karatEntrySchema = new Schema({
  karat: { type: Number, required: true }, // 18,21,...
  grams: { type: mongoose.Schema.Types.Decimal128, default: 0 }
}, { _id: false });

const scrapStoreSchema = new Schema({
  branch: { type: String, required: true, index: true }, // اسم الفرع أو كوده
  totals: { type: [karatEntrySchema], default: [] }, // list of karat balances
  notes: String
}, { timestamps: true });

/**
 * Helper methods (instance methods) could be added if desired,
 * but controller below will handle updates with sessions.
 */

export default mongoose.model("ScrapStore", scrapStoreSchema);
