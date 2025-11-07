import mongoose from "mongoose";
const { Schema } = mongoose;

const cashMovementSchema = new Schema({
  branch: String,
  type: { type: String, enum: ["deposit","expense","transfer"], required: true },
  amount: mongoose.Schema.Types.Decimal128,
  source_branch: String,
  reason: String,
  user: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("CashMovement", cashMovementSchema);
