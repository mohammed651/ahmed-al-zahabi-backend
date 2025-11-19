import mongoose from "mongoose";
const { Schema } = mongoose;

const branchSchema = new Schema({
  name: { type: String, required: true, unique: true },

  // showroom = كاشير  
  // warehouse = المخزن  
  // store = لو ضفت فروع لاحقاً
  type: { 
    type: String, 
    enum: ["store", "showroom", "warehouse"], 
    default: "store" 
  },

  // كود ثابت للفرع — مهم لجلب الفرع من user.branch
  code: { type: String, required: true, unique: true },

  // رصيد الكاش داخل كل فرع
  cash_balance: { 
    type: mongoose.Schema.Types.Decimal128, 
    default: 0 
  }
}, { timestamps: true });

export default mongoose.model("Branch", branchSchema);