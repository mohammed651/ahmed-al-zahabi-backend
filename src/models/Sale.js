import mongoose from "mongoose";
const { Schema } = mongoose;

const saleItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  quantity: { type: Number, default: 1 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  makingCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  subtotal: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: true });

const exchangedScrapSchema = new Schema({
  name: String,
  karat: Number,
  weight: { type: mongoose.Schema.Types.Decimal128 },
  pricePerGram: { type: mongoose.Schema.Types.Decimal128 },
  total: { type: mongoose.Schema.Types.Decimal128 }
}, { _id: true });

const additionalServiceSchema = new Schema({
  name: String,
  price: { type: mongoose.Schema.Types.Decimal128 },
  icon: String,
  type: { type: String, enum: ["fixed", "custom"], default: "fixed" }
}, { _id: true });

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

  subtotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  scrapTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  servicesTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  total: { type: mongoose.Schema.Types.Decimal128 },
  roundedTotal: { type: mongoose.Schema.Types.Decimal128 },

  payment: { type: paymentSchema, required: true },

  exchangedScrap: [exchangedScrapSchema],
  additionalServices: [additionalServiceSchema],

  manualDiscount: { type: mongoose.Schema.Types.Decimal128, default: 0 },

  status: { 
    type: String, 
    enum: ["draft", "pending", "paid", "cancelled"], 
    default: "draft" 
  },

  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  notes: String
}, { timestamps: true });

function roundToNearest5Number(n) {
  if (!isFinite(n)) return 0;
  return Math.round(n / 5) * 5;
}

saleSchema.pre("save", function(next) {
  try {
    let itemsTotal = 0;
    this.items = (this.items || []).map(item => {
      const price = Number(item.pricePerGram?.toString?.() || item.price?.toString?.() || 0);
      const weight = Number(item.weight?.toString?.() || 0);
      const making = Number(item.makingCost?.toString?.() || 0);
      const quantity = Number(item.quantity || 1);

      let rawSubtotal = Number(item.subtotal?.toString?.());
      if (!rawSubtotal || rawSubtotal === 0) {
        rawSubtotal = (price + making) * weight * quantity;
      }

      const roundedSubtotal = roundToNearest5Number(rawSubtotal);

      item.subtotal = mongoose.Types.Decimal128.fromString(String(roundedSubtotal));

      itemsTotal += roundedSubtotal;
      return item;
    });

    // SCRAP
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

    // خدمات
    const servicesTotal = (this.additionalServices || []).reduce((sum, service) => {
      const p = Number(service.price?.toString?.() || 0);
      return sum + p;
    }, 0);

    const manualDiscount = Number(this.manualDiscount?.toString?.() || 0);

    // حفظ الحقول المالية
    this.subtotal = mongoose.Types.Decimal128.fromString(String(itemsTotal));
    this.scrapTotal = mongoose.Types.Decimal128.fromString(String(scrapTotal));
    this.servicesTotal = mongoose.Types.Decimal128.fromString(String(servicesTotal));

    const netTotal = itemsTotal + servicesTotal - scrapTotal - manualDiscount;
    this.total = mongoose.Types.Decimal128.fromString(String(netTotal));

    const roundedAbs = roundToNearest5Number(Math.abs(netTotal));
    this.roundedTotal = mongoose.Types.Decimal128.fromString(String(roundedAbs));

    // ضبط الـ payment.amount (دائمًا موجب)
    if (!this.payment) {
      this.payment = {
        method: "cash",
        amount: mongoose.Types.Decimal128.fromString(String(roundedAbs))
      };
    } else {
      this.payment.amount = mongoose.Types.Decimal128.fromString(String(roundedAbs));
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Sale", saleSchema);
