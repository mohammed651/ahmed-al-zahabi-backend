import mongoose from "mongoose";
const { Schema } = mongoose;

const saleItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  quantity: { type: Number, default: 1 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  makingCost: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // المصنعية
  subtotal: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: true }); // غيرنا لـ true عشان نقدر نمسح عناصر

const exchangedScrapSchema = new Schema({
  name: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  total: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: true }); // غيرنا لـ true

const additionalServiceSchema = new Schema({
  name: String,
  price: { type: mongoose.Schema.Types.Decimal128 },
  icon: String,
  type: { type: String, enum: ["fixed", "custom"], default: "fixed" } // أضفنا نوع الخدمة
}, { _id: true }); // غيرنا لـ true

// أضفنا schema للدفع
const paymentSchema = new Schema({
  method: { 
    type: String, 
    enum: ["cash", "electronic", "installment"], 
    required: true 
  },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  electronicAccount: { type: Schema.Types.ObjectId, ref: "ElectronicAccount" },
  installmentDetails: {
    months: Number,
    monthlyPayment: { type: mongoose.Schema.Types.Decimal128 }
  }
}, { _id: false });

const saleSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true },
  branch: String,
  items: [saleItemSchema],
  customer: {
    name: String,
    phone: String
  },
  
  // أضفنا الحسابات الإضافية
  subtotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  scrapTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  servicesTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  total: { type: mongoose.Schema.Types.Decimal128 },
  roundedTotal: { type: mongoose.Schema.Types.Decimal128 }, // الإجمالي بعد التقريب
  
  // غيرنا paymentMethod لـ payment object
  payment: { type: paymentSchema, required: true },
  
  // غيرنا exchangedScrap لـ array
  exchangedScrap: [exchangedScrapSchema], // من object لـ array
  
  additionalServices: [additionalServiceSchema],
  manualDiscount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  
  // أضفنا status
  status: { 
    type: String, 
    enum: ["draft", "pending", "paid", "cancelled"], 
    default: "draft" 
  },
  
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  notes: String // أضفنا ملاحظات
}, { timestamps: true });

// أضفنا middleware للحسابات التلقائية
saleSchema.pre("save", function(next) {
  // حساب المجموع الفرعي للمنتجات
  const itemsTotal = this.items.reduce((sum, item) => {
    return sum + Number(item.subtotal?.toString() || 0);
  }, 0);
  
  // حساب إجمالي السكراب
  const scrapTotal = this.exchangedScrap.reduce((sum, scrap) => {
    return sum + Number(scrap.total?.toString() || 0);
  }, 0);
  
  // حساب إجمالي الخدمات
  const servicesTotal = this.additionalServices.reduce((sum, service) => {
    return sum + Number(service.price?.toString() || 0);
  }, 0);
  
  this.subtotal = mongoose.Types.Decimal128.fromString(String(itemsTotal));
  this.scrapTotal = mongoose.Types.Decimal128.fromString(String(scrapTotal));
  this.servicesTotal = mongoose.Types.Decimal128.fromString(String(servicesTotal));
  
  // حساب الإجمالي النهائي
  const netTotal = itemsTotal + servicesTotal - scrapTotal - Number(this.manualDiscount?.toString() || 0);
  this.total = mongoose.Types.Decimal128.fromString(String(netTotal));
  
  // تقريب لأقرب 5 جنيه
  const rounded = Math.ceil(netTotal / 5) * 5;
  this.roundedTotal = mongoose.Types.Decimal128.fromString(String(rounded));
  
  next();
});

export default mongoose.model("Sale", saleSchema);