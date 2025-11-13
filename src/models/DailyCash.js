import mongoose from "mongoose";
const { Schema } = mongoose;

const dailyCashSchema = new Schema({
  branch: { type: String, required: true },
  date: { type: Date, required: true },
  
  // فتح اليوم
  openingBills: {
    "200": { type: Number, default: 0 },
    "100": { type: Number, default: 0 },
    "50": { type: Number, default: 0 },
    "20": { type: Number, default: 0 },
    "10": { type: Number, default: 0 },
    "5": { type: Number, default: 0 }
  },
  openingTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  // تحويلات خلال اليوم
  storeTransfers: [{
    time: String,
    amount: { type: mongoose.Schema.Types.Decimal128 },
    notes: String
  }],
  
  // غلق اليوم
  closingBills: {
    "200": { type: Number, default: 0 },
    "100": { type: Number, default: 0 },
    "50": { type: Number, default: 0 },
    "20": { type: Number, default: 0 },
    "10": { type: Number, default: 0 },
    "5": { type: Number, default: 0 }
  },
  closingTotal: { type: mongoose.Schema.Types.Decimal128 },
  
  status: { type: String, enum: ["open", "closed"], default: "open" },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("DailyCash", dailyCashSchema);