import mongoose from "mongoose";
const { Schema } = mongoose;

const branchSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["store","showroom","warehouse"], default: "store" },
  cash_balance: { type: mongoose.Schema.Types.Decimal128, default: 0 }
}, { timestamps: true });

export default mongoose.model("Branch", branchSchema);
