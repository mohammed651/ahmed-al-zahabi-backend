import mongoose from "mongoose";
const { Schema } = mongoose;

const supplierSchema = new Schema({
  name: { type: String, required: true },
  phone: String,
  balance_type: { type: String, enum: ["cash","gold"], default: "cash" },
  balance_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  notes: String
}, { timestamps: true });

export default mongoose.model("Supplier", supplierSchema);
