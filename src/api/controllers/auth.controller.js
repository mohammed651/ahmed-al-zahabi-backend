import User from "../../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../../config/index.js";
import { success, error as respError } from "../../utils/responses.js";

export async function register(req, res) {
  const { name, username, password, role, branch } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return respError(res, "اسم المستخدم مستخدم بالفعل", 400);
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const u = await User.create({ name, username, passwordHash: hash, role, branch });
  return success(res, { id: u._id, name: u.name }, "تم إنشاء الحساب");
}

export async function login(req, res) {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return respError(res, "بيانات دخول غير صحيحة", 400);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return respError(res, "بيانات دخول غير صحيحة", 400);

  const token = jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: "12h" });
  return success(res, { token, user: { id: user._id, name: user.name, role: user.role, branch: user.branch } }, "تم تسجيل الدخول");
}
