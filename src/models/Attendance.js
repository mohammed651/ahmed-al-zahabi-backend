import mongoose from "mongoose";
const { Schema } = mongoose;

const attendanceSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  date: Date,
  status: { type: String, enum: ["present","absent","late","vacation"], default: "present" },
  shift: { type: String, enum: ["morning","evening"], default: "morning" },
  notes: String
}, { timestamps: true });

export default mongoose.model("Attendance", attendanceSchema);
