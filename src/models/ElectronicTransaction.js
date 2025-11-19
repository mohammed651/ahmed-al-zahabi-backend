import mongoose from "mongoose";
const { Schema } = mongoose;


const electronicTransactionSchema = new Schema({
account: { type: Schema.Types.ObjectId, ref: "ElectronicAccount", required: true },
type: { type: String, enum: ["deposit", "withdrawal", "transfer"], required: true },
amount: { type: mongoose.Schema.Types.Decimal128, required: true },
reference: String,
notes: String,
status: { type: String, enum: ["pending", "completed", "cancelled"], default: "completed" },
recordedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });


export default mongoose.model("ElectronicTransaction", electronicTransactionSchema);