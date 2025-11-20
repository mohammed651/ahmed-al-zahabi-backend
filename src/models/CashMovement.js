// src/models/CashMovement.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const cashMovementSchema = new Schema({
  branch: String,
  type: { type: String, enum: ["deposit","expense","transfer"], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  source_branch: String,
  reason: String,
  user: { type: Schema.Types.ObjectId, ref: "User" },

  // new fields for tracing
  referenceType: String,
  referenceId: { type: Schema.Types.ObjectId, refPath: 'referenceType' },
  fromBranch: String,
  toBranch: String,

  // fields for reversal and editing
  reversed: { type: Boolean, default: false },
  reversedAt: Date,
  reversedBy: { type: Schema.Types.ObjectId, ref: "User" },
  originalMovementId: { type: Schema.Types.ObjectId, ref: "CashMovement" },
  
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  updateReason: String,

}, { timestamps: true });

export default mongoose.model("CashMovement", cashMovementSchema);