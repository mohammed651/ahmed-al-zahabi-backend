import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { success } from "../../utils/responses.js";

const router = express.Router();

// list users
router.get("/", authMiddleware, permit("admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash");
  return success(res, users, "قائمة المستخدمين");
});

// create user
router.post("/", authMiddleware, permit("admin"), async (req, res) => {
  const { name, username, password, role, branch } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const user = await User.create({ name, username, passwordHash: hash, role, branch });
  return success(res, { id: user._id, name: user.name }, "تم إنشاء المستخدم");
});

export default router;
