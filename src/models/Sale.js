import mongoose from "mongoose";
const { Schema } = mongoose;

const saleItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  quantity: Number,
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  makingCost: { type: mongoose.Schema.Types.Decimal128 },
  subtotal: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: false });

const exchangedScrapSchema = new Schema({
  name: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  total: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: false });

const saleSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true },
  branch: String,
  items: [saleItemSchema],
  customer: {
    name: String,
    phone: String
  },
  total: { type: mongoose.Schema.Types.Decimal128 },
  paymentMethod: { type: String, enum: ["cash","card","credit"], default: "cash" },
  exchangedScrap: { type: exchangedScrapSchema, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Sale", saleSchema);
