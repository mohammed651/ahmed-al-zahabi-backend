import mongoose from "mongoose";
const { Schema } = mongoose;


const electronicAccountSchema = new Schema({
name: { type: String, required: true, unique: true },
description: String,
type: {
type: String,
enum: ["card", "mobile_wallet", "bank_transfer", "other"],
default: "other"
},
currentBalance: { type: mongoose.Schema.Types.Decimal128, default: 0 },
status: { type: String, enum: ["active", "inactive"], default: "active" },
color: { type: String, default: "#3B82F6" },
icon: { type: String, default: "💳" }
}, { timestamps: true });


export default mongoose.model("ElectronicAccount", electronicAccountSchema);