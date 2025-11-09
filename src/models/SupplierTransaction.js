// src/models/SupplierTransaction.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const supplierTransactionSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
  type: { type: String, enum: ["debt","payment","adjustment"], required: true },
  amountCash: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // مبلغ نقدي مضاف/منقوص
  amountGrams: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // جرامات مضافة/منقوصة
  direction: { type: String, enum: ["in","out"], required: true }, // in = المورد لنا (المحل عليه دين) ; out = نحن دفعنا للمورد (نقص الدين)
  method: { type: String, enum: ["purchase","manual_debt","manual_pay","settle_with_scrap","settle_with_cash"], default: "manual_debt" },
  note: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("SupplierTransaction", supplierTransactionSchema);
