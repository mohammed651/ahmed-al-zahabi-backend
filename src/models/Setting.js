// src/models/Setting.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  type: { type: String, enum: ["string", "number", "boolean", "object", "array"], required: true },
  category: { type: String, required: true },
  description: String,
  isPublic: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Setting", settingSchema);