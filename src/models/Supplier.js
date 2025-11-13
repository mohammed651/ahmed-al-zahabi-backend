// src/models/Supplier.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const supplierSchema = new Schema({
  name: { type: String, required: true, unique: true },
  phone: String,
  balanceCash: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // الدين النقدي (المحل مدين للتاجر)
  balanceGrams: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // الدين بالجرامات (المحل مدين للتاجر)
  totalPaidCash: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // إجمالي المدفوع نقداً
  totalPaidGrams: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // إجمالي المدفوع جرامات
  notes: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// إضافة ميثودز مساعدة
supplierSchema.methods.getTotalCashDebt = function() {
  return Number(this.balanceCash?.toString() || 0);
};

supplierSchema.methods.getTotalGramsDebt = function() {
  return Number(this.balanceGrams?.toString() || 0);
};

supplierSchema.methods.getTotalDebt = function() {
  return {
    cash: this.getTotalCashDebt(),
    grams: this.getTotalGramsDebt()
  };
};

export default mongoose.model("Supplier", supplierSchema);