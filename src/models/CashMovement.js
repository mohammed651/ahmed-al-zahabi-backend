import mongoose from "mongoose";
const { Schema } = mongoose;


const cashMovementSchema = new Schema({
branch: String,
type: { type: String, enum: ["deposit","expense","transfer"], required: true },
amount: { type: mongoose.Schema.Types.Decimal128, required: true },
source_branch: String,
reason: String,
user: { type: Schema.Types.ObjectId, ref: "User" },


// new fields for tracing
referenceType: String, // e.g. 'sale', 'return', 'daily'
referenceId: { type: Schema.Types.ObjectId, refPath: 'referenceType' }, // optional polymorphic ref
fromBranch: String, // for transfers
toBranch: String // for transfers
}, { timestamps: true });


export default mongoose.model("CashMovement", cashMovementSchema);