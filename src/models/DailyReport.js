import mongoose from "mongoose";
const { Schema } = mongoose;

const dailyReportSchema = new Schema({
  branch: String,
  date: Date,
  total_sales: mongoose.Schema.Types.Decimal128,
  total_purchases: mongoose.Schema.Types.Decimal128,
  total_expenses: mongoose.Schema.Types.Decimal128,
  total_deposits: mongoose.Schema.Types.Decimal128,
  net_cash: mongoose.Schema.Types.Decimal128
}, { timestamps: true });

export default mongoose.model("DailyReport", dailyReportSchema);
