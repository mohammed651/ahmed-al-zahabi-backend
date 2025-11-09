// src/middlewares/permit.middleware.js
export const permit = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "غير مصرح" });
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: "ممنوع - صلاحية غير كافية" });
  next();
};
