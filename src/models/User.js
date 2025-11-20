
import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["admin","accountant","storekeeper","employee"], 
    default: "employee" 
  },
  branch: { type: String }, // حنفرض قيمة تلقائية لغير الأدمن
  status: { type: String, enum: ["active","inactive"], default: "active" }
}, { timestamps: true });

// 🔥 لو المستخدم مش admin وماحدّدش فرع → نفرض "الدور الأول"
userSchema.pre("save", function(next) {
  try {
    if (this.role !== "admin" && (!this.branch || this.branch === "")) {
      this.branch = "floor1";
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("User", userSchema);
