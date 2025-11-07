import mongoose from "mongoose";
const { Schema } = mongoose;

const purchaseSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
  branch: String,
  items: [{
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    weight: mongoose.Schema.Types.Decimal128,
    pricePerGram: mongoose.Schema.Types.Decimal128,
    quantity: Number,
    subtotal: mongoose.Schema.Types.Decimal128
  }],
  total: mongoose.Schema.Types.Decimal128,
  type: { type: String, enum: ["cash","gold"], default: "cash" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Purchase", purchaseSchema);
