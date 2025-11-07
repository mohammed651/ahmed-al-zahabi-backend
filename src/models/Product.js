import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
  code: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String },
  karat: { type: Number },
  weight: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  count_in_store: { type: Number, default: 0 },
  count_in_showcase: { type: Number, default: 0 },
  images: [String],
  status: { type: String, default: "available" }
}, { timestamps: true });

export default mongoose.model("Product", productSchema);
