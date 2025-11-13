// src/models/SupplierTransaction.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const supplierTransactionSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
  type: { type: String, enum: ["debt","payment","adjustment"], required: true },
  amountCash: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  amountGrams: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  direction: { type: String, enum: ["in","out"], required: true },
  method: { 
    type: String, 
    enum: [
      "initial_debt",
      "manual_debt", 
      "manual_payment", 
      "manual_adjustment",
      "purchase_settlement"
    ], 
    default: "manual_debt" 
  },
  note: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// إضافة indexes للأداء
supplierTransactionSchema.index({ supplier: 1, createdAt: -1 });
supplierTransactionSchema.index({ type: 1 });

export default mongoose.model("SupplierTransaction", supplierTransactionSchema);