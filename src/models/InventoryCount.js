// src/models/InventoryCount.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const countedProductSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: String,
  productCode: String,
  karat: Number,
  expectedCount: { type: Number, default: 0 }, // الكمية المتوقعة من النظام
  actualCount: { type: Number, default: 0 },   // الكمية الفعلية بالمخزن
  difference: { type: Number, default: 0 },    // الفرق (فعلي - متوقع)
  notes: String,
  countedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { _id: true });

const inventoryCountSchema = new Schema({
  countNumber: { type: String, required: true, unique: true }, // رقم الجرد
  title: { type: String, required: true }, // عنوان الجرد (جرد ربع سنوي، جرد مفاجئ، إلخ)
  branch: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["scheduled", "spot", "periodic", "full"], 
    default: "scheduled" 
  },
  
  // المنتجات المعدودة
  countedProducts: [countedProductSchema],
  
  // الإحصائيات
  totalProducts: { type: Number, default: 0 }, // إجمالي المنتجات
  totalExpected: { type: Number, default: 0 }, // إجمالي المتوقع
  totalActual: { type: Number, default: 0 },   // إجمالي الفعلي
  totalDifference: { type: Number, default: 0 }, // إجمالي الفرق
  
  // تحليل الفروق
  positiveDifferences: { type: Number, default: 0 }, // منتجات زائدة
  negativeDifferences: { type: Number, default: 0 }, // منتجات ناقصة
  zeroDifferences: { type: Number, default: 0 },     // منتجات مطابقة
  
  // الحالة
  status: { 
    type: String, 
    enum: ["draft", "counting", "review", "completed", "adjusted", "cancelled"], 
    default: "draft" 
  },
  
  // التواريخ
  countDate: { type: Date, default: Date.now }, // تاريخ الجرد
  startTime: Date, // وقت بدء الجرد
  endTime: Date,   // وقت انتهاء الجرد
  
  // الفريق
  countedBy: [{ type: Schema.Types.ObjectId, ref: "User" }], // فريق الجرد
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },  // المراجع
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },  // المعتمد
  
  // ملاحظات
  notes: String,
  adjustmentNotes: String, // ملاحظات التسوية

}, { timestamps: true });

// Middleware للحسابات التلقائية
inventoryCountSchema.pre("save", function(next) {
  // حساب الإحصائيات
  this.totalProducts = this.countedProducts.length;
  
  let totalExpected = 0;
  let totalActual = 0;
  let positiveDiff = 0;
  let negativeDiff = 0;
  let zeroDiff = 0;

  this.countedProducts.forEach(product => {
    totalExpected += product.expectedCount || 0;
    totalActual += product.actualCount || 0;
    
    const diff = (product.actualCount || 0) - (product.expectedCount || 0);
    product.difference = diff;
    
    if (diff > 0) positiveDiff++;
    else if (diff < 0) negativeDiff++;
    else zeroDiff++;
  });

  this.totalExpected = totalExpected;
  this.totalActual = totalActual;
  this.totalDifference = totalActual - totalExpected;
  this.positiveDifferences = positiveDiff;
  this.negativeDifferences = negativeDiff;
  this.zeroDifferences = zeroDiff;

  next();
});

export default mongoose.model("InventoryCount", inventoryCountSchema);