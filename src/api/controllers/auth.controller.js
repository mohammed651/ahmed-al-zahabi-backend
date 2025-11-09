// src/api/controllers/auth.controller.js
import User from '../../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { success, error as respError } from '../../utils/responses.js';
import RefreshToken from '../../models/RefreshToken.js';
import { v4 as uuidv4 } from 'uuid';

export async function register(req, res) {
  try {
    const { name, username, password, role, branch } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return respError(res, 'اسم المستخدم مستخدم بالفعل', 400);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const u = await User.create({ name, username, passwordHash: hash, role, branch });
    return success(res, { id: u._id, name: u.name }, 'تم إنشاء الحساب', 201);
  } catch (err) {
    console.error(err);
    return respError(res, 'فشل في التسجيل', 500, err.message);
  }
}

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: '30m' });
}

function signRefreshToken() {
  return uuidv4();
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return respError(res, 'بيانات دخول غير صحيحة', 400);
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return respError(res, 'بيانات دخول غير صحيحة', 400);

    const accessToken = signAccessToken(user);
    const refreshTokenValue = signRefreshToken();
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000); // 30 days

    await RefreshToken.create({ token: refreshTokenValue, user: user._id, expiresAt });

    // send refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshTokenValue, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 30*24*60*60*1000
    });

    return success(res, { accessToken, user: { id: user._id, name: user.name, role: user.role, branch: user.branch } }, 'تم تسجيل الدخول');
  } catch (err) {
    console.error(err);
    return respError(res, 'فشل في تسجيل الدخول', 500, err.message);
  }
}

export async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return respError(res, 'غير مصرح - لا يوجد توكن تحديث', 401);

    const stored = await RefreshToken.findOne({ token, revoked: false });
    if (!stored) return respError(res, 'توكن التحديث غير صالح', 401);
    if (new Date() > new Date(stored.expiresAt)) return respError(res, 'توكن التحديث منتهي', 401);

    const user = await User.findById(stored.user);
    if (!user) return respError(res, 'المستخدم غير موجود', 401);

    // rotate refresh token: revoke old, issue new
    stored.revoked = true;
    await stored.save();

    const newRefresh = signRefreshToken();
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
    await RefreshToken.create({ token: newRefresh, user: user._id, expiresAt });

    const accessToken = signAccessToken(user);

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 30*24*60*60*1000
    });

    return success(res, { accessToken, user: { id: user._id, name: user.name, role: user.role, branch: user.branch } }, 'تم تجديد التوكن');
  } catch (err) {
    console.error(err);
    return respError(res, 'فشل في تجديد التوكن', 500, err.message);
  }
}

export async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await RefreshToken.findOneAndUpdate({ token }, { revoked: true });
    }
    res.clearCookie('refreshToken');
    return success(res, {}, 'تم تسجيل الخروج');
  } catch (err) {
    console.error(err);
    return respError(res, 'فشل في تسجيل الخروج', 500, err.message);
  }
}
