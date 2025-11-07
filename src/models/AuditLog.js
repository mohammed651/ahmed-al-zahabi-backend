import mongoose from "mongoose";
const { Schema } = mongoose;

const auditLogSchema = new Schema({
  entity: String,
  entityId: Schema.Types.ObjectId,
  action: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  performedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("AuditLog", auditLogSchema);
