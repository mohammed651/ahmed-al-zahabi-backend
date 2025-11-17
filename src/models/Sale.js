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
  electronicAccount: { type: mongoose.Schema.Types.ObjectId, ref: "ElectronicAccount" },
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

// دالة تقريب لأقرب 5 باستخدام ROUND (مطابقة للفرونت)
function roundToNearest5Number(n) {
  if (!isFinite(n)) return 0;
  return Math.round(n / 5) * 5;
}
// أضفنا middleware للحسابات التلقائية (محدث - roundedTotal و payment.amount موجبين)
saleSchema.pre("save", function(next) {
  try {
    // حساب المجموع الفرعي للمنتجات.
    let itemsTotal = 0;
    this.items = (this.items || []).map(item => {
      const price = Number(item.pricePerGram?.toString?.() || item.price?.toString?.() || 0);
      const weight = Number(item.weight?.toString?.() || 0);
      const making = Number(item.makingCost?.toString?.() || 0);
      const quantity = Number(item.quantity || item.qty || 1);

      let rawSubtotal = Number(item.subtotal?.toString?.());
      if (!rawSubtotal || rawSubtotal === 0) {
        rawSubtotal = (price + making) * weight * quantity;
      }

      const roundedSubtotal = roundToNearest5Number(rawSubtotal);

      // نخزن Decimal128
      item.subtotal = mongoose.Types.Decimal128.fromString(String(roundedSubtotal));

      itemsTotal += roundedSubtotal;
      return item;
    });

    // حساب إجمالي السكراب
    let scrapTotal = 0;
    this.exchangedScrap = (this.exchangedScrap || []).map(scrap => {
      const price = Number(scrap.pricePerGram?.toString?.() || 0);
      const weight = Number(scrap.weight?.toString?.() || 0);
      let raw = Number(scrap.total?.toString?.());
      if (!raw || raw === 0) raw = price * weight;
      const rounded = roundToNearest5Number(raw);
      scrap.total = mongoose.Types.Decimal128.fromString(String(rounded));
      scrapTotal += rounded;
      return scrap;
    });

    // حساب إجمالي الخدمات
    const servicesTotal = (this.additionalServices || []).reduce((sum, service) => {
      const p = Number(service.price?.toString?.() || 0);
      return sum + p;
    }, 0);

    const manualDiscount = Number(this.manualDiscount?.toString?.() || 0);

    // تعيين الحقول كـ Decimal128
    this.subtotal = mongoose.Types.Decimal128.fromString(String(itemsTotal));
    this.scrapTotal = mongoose.Types.Decimal128.fromString(String(scrapTotal));
    this.servicesTotal = mongoose.Types.Decimal128.fromString(String(servicesTotal));

    // حساب الإجمالي النهائي (قد يكون سالباً للدلالة على أن المتجر يدفع)
    const netTotal = itemsTotal + servicesTotal - scrapTotal - manualDiscount;
    this.total = mongoose.Types.Decimal128.fromString(String(netTotal));

    // **هنا التعديل الأساسي**: roundedTotal يمثل مقدار الدفع الفعلي (دائماً موجب)
    const roundedAbs = roundToNearest5Number(Math.abs(netTotal));
    this.roundedTotal = mongoose.Types.Decimal128.fromString(String(roundedAbs));

    // اضبط payment.amount ليطابق المبلغ الذي يُعرض/يُدفع (موجب)
    if (!this.payment) {
      this.payment = { method: "cash", amount: mongoose.Types.Decimal128.fromString(String(roundedAbs)) };
    } else {
      try {
        this.payment.amount = mongoose.Types.Decimal128.fromString(String(roundedAbs));
      } catch (e) {
        console.warn('Failed to set payment.amount to Decimal128 in pre-save:', e);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});


export default mongoose.model("Sale", saleSchema);
