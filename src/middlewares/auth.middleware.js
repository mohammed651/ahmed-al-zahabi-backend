import jwt from "jsonwebtoken"; // 🔥 أضف هذا السطر
import config from "../config/index.js";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔍 Auth Header:', req.headers.authorization);
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log('❌ No Bearer token found');
      return res.status(401).json({ success: false, message: "غير مصرح - لا يوجد توكن" });
    }
    
    const token = authHeader.split(" ")[1];
    console.log('🔍 Token:', token);
    
    const payload = jwt.verify(token, config.jwtSecret); // 🔥 الآن هتشتغل
    console.log('🔍 JWT Payload:', payload);
    
    const userId = payload.id;
    console.log('🔍 User ID from token:', userId);
    
    const user = await User.findById(userId).select("-passwordHash");
    
    if (!user) {
      console.log('❌ User not found with ID:', userId);
      return res.status(401).json({ success: false, message: "غير مصرح" });
    }
    
    console.log('✅ User found:', user.name, user._id);
    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Auth middleware error:', err.message);
    return res.status(401).json({ success: false, message: "توكن غير صالح" });
  }
};