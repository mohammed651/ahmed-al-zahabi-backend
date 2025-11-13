// src/models/Return.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const returnedItemSchema = new Schema({
  originalItem: { type: Schema.Types.ObjectId }, // المرجع للعنصر الأصلي في الفاتورة
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  makingCost: { type: mongoose.Schema.Types.Decimal128 },
  quantity: { type: Number, default: 1 },
  originalSubtotal: { type: mongoose.Schema.Types.Decimal128 }, // القيمة الأصلية
  refundAmount: { type: mongoose.Schema.Types.Decimal128 }, // المبلغ المراد استرجاعه
  reason: { type: String, required: true }, // سبب الإرجاع
  condition: { type: String, enum: ["new", "used", "damaged"], default: "new" } // حالة المنتج
}, { _id: true });

const exchangeItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  makingCost: { type: mongoose.Schema.Types.Decimal128 },
  quantity: { type: Number, default: 1 },
  subtotal: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: true });

const refundSchema = new Schema({
  method: { type: String, enum: ["cash", "electronic", "credit"], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  electronicAccount: { type: Schema.Types.ObjectId, ref: "ElectronicAccount" },
  transactionReference: String // رقم المرجع إذا كان تحويل إلكتروني
}, { _id: false });

const returnSchema = new Schema({
  returnNumber: { type: String, required: true, unique: true }, // رقم إرجاع
  originalSale: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
  originalInvoiceNo: { type: String, required: true }, // رقم الفاتورة الأصلية
  
  type: { 
    type: String, 
    enum: ["full_return", "partial_return", "exchange"], 
    required: true 
  },
  
  // العناصر المرتجعة
  returnedItems: [returnedItemSchema],
  
  // العناصر البديلة (في حالة الاستبدال)
  exchangeItems: [exchangeItemSchema],
  
  // بيانات الاسترجاع المالي
  refund: { type: refundSchema },
  
  // الحسابات
  totalReturnedValue: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // إجمالي قيمة المرتجع
  totalExchangeValue: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // إجمالي قيمة البديل
  netRefundAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // صافي المبلغ المسترجع
  
  // الحالة
  status: { 
    type: String, 
    enum: ["pending", "approved", "completed", "rejected", "cancelled"], 
    default: "pending" 
  },
  
  // معلومات إضافية
  reason: String, // سبب عام للإرجاع
  notes: String,
  branch: String,
  
  // المستخدمين
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, // طالب الإرجاع
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" }, // معتمد بواسطة
  processedBy: { type: Schema.Types.ObjectId, ref: "User" }, // معالج بواسطة

}, { timestamps: true });

// Middleware للحسابات التلقائية
returnSchema.pre("save", function(next) {
  // حساب إجمالي قيمة المرتجعات
  const returnedTotal = this.returnedItems.reduce((sum, item) => {
    return sum + Number(item.refundAmount?.toString() || item.originalSubtotal?.toString() || 0);
  }, 0);
  
  // حساب إجمالي قيمة البدائل
  const exchangeTotal = this.exchangeItems.reduce((sum, item) => {
    return sum + Number(item.subtotal?.toString() || 0);
  }, 0);
  
  this.totalReturnedValue = mongoose.Types.Decimal128.fromString(String(returnedTotal));
  this.totalExchangeValue = mongoose.Types.Decimal128.fromString(String(exchangeTotal));
  
  // حساب صافي المبلغ المسترجع
  if (this.type === "exchange") {
    this.netRefundAmount = mongoose.Types.Decimal128.fromString(String(Math.max(0, returnedTotal - exchangeTotal)));
  } else {
    this.netRefundAmount = mongoose.Types.Decimal128.fromString(String(returnedTotal));
  }
  
  next();
});

export default mongoose.model("Return", returnSchema);