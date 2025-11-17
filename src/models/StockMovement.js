import mongoose from "mongoose";
const { Schema } = mongoose;

const stockMovementSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  type: { type: String, enum: ["in", "out", "transfer", "adjustment"], required: true },
  from: { type: String, enum: ["store", "showcase", "sale"], required: true },
  to:   { type: String, enum: ["store", "showcase", "sale"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  performedByEmployeeName: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  notes: String
}, { timestamps: true });

stockMovementSchema.methods.toJSON = function() {
  const movement = this.toObject();
  return {
    id: movement._id ? movement._id.toString() : null,
    product: movement.product ? movement.product.toString() : null,
    type: movement.type,
    from: movement.from,
    to: movement.to,
    quantity: movement.quantity,
    performedByEmployeeName: movement.performedByEmployeeName,
    recordedBy: movement.recordedBy ? movement.recordedBy.toString() : null,
    notes: movement.notes || null,
    createdAt: movement.createdAt ? movement.createdAt.toISOString() : null,
    updatedAt: movement.updatedAt ? movement.updatedAt.toISOString() : null
  };
};

export default mongoose.model("StockMovement", stockMovementSchema);
