import mongoose from 'mongoose';
const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
  token: { type: String, required: true, index: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('RefreshToken', refreshTokenSchema);
