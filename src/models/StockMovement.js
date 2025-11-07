import mongoose from "mongoose";
const { Schema } = mongoose;

const stockMovementSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  type: { type: String, enum: ["in","out","transfer","adjustment","sold","returned","scrap"], required: true },
  from: String,
  to: String,
  quantity: { type: Number, required: true },
  note: String,
  performedByEmployeeName: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("StockMovement", stockMovementSchema);
