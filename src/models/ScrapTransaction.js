// src/models/ScrapTransaction.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const scrapTransactionSchema = new Schema({
  type: { type: String, enum: ["receive","move","consume","sell_to_trader","adjust"], required: true },
  branchFrom: { type: String }, // optional (for move)
  branchTo: { type: String },   // optional (for move/receive)
  karat: { type: Number, required: true },
  grams: { type: mongoose.Schema.Types.Decimal128, required: true },
  value: { type: mongoose.Schema.Types.Decimal128 }, // optional monetary value if any
  performedBy: { type: String }, // اسم الموظف المستلم/الفاعل
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" }, // اللي دخل السجل
  relatedSupplierId: { type: Schema.Types.ObjectId, ref: "Supplier" }, // اختياري لو العملية لها علاقة بتاجر (لكن لا يحدث تلقائي)
  notes: String
}, { timestamps: true });

export default mongoose.model("ScrapTransaction", scrapTransactionSchema);
