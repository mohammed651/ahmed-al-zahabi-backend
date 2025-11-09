// src/middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "غير مصرح - لا يوجد توكن" });
    }
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.id).select("-passwordHash");
    if (!user) return res.status(401).json({ success: false, message: "غير مصرح" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "توكن غير صالح" });
  }
};
