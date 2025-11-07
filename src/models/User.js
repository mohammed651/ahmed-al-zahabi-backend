import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin","accountant","storekeeper","employee"], default: "employee" },
  branch: { type: String },
  status: { type: String, enum: ["active","inactive"], default: "active" }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
