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
}, { 
  timestamps: true
});

// تحويل لـ JSON بشكل كامل
productSchema.methods.toJSON = function() {
  const product = this.toObject();
  
  return {
    id: product._id ? product._id.toString() : null,
    code: product.code,
    name: product.name,
    category: product.category,
    karat: product.karat,
    weight: product.weight ? product.weight.toString() : '0',
    pricePerGram: product.pricePerGram ? product.pricePerGram.toString() : '0',
    count_in_store: product.count_in_store,
    count_in_showcase: product.count_in_showcase,
    images: product.images,
    status: product.status,
    createdAt: product.createdAt ? product.createdAt.toISOString() : null,
    updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null
  };
};

export default mongoose.model("Product", productSchema);