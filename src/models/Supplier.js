// src/models/Supplier.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const supplierSchema = new Schema({
  name: { type: String, required: true },
  phone: String,
  // نفصل بين رصيد نقدي ورصيد جرامي بدل حقل واحد
  balanceCash: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // مبلغ نقدي دين على المحل
  balanceGrams: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // رصيد جرامات (gold debt)
  notes: String
}, { timestamps: true });

export default mongoose.model("Supplier", supplierSchema);
