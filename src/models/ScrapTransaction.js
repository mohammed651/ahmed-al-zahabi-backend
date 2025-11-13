// src/models/ScrapTransaction.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const scrapTransactionSchema = new Schema({
  type: { 
    type: String, 
    enum: ["purchase_from_customer", "add_from_invoice", "direct_add", "transfer_to_store", "consume", "move_between_stores", "adjust"], 
    required: true 
  },
  branchFrom: { type: String },
  branchTo: { type: String },
  karat: { type: Number, required: true },
  grams: { type: mongoose.Schema.Types.Decimal128, required: true },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  totalValue: { type: mongoose.Schema.Types.Decimal128 },
  performedBy: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  source: { type: String },
  destination: { type: String },
  notes: String,
  customerName: { type: String },
  invoiceNumber: { type: String }
}, { timestamps: true });

export default mongoose.model("ScrapTransaction", scrapTransactionSchema);