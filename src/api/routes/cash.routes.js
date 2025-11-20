// src/api/routes/cash.routes.js
import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { 
  createCashMovement, 
  listCash, 
  dailyOpening,
  dailyClosing,
  cashTransfer, 
  reconcile,
  reverseMovement,
  updateMovement,
  getMovement
} from "../controllers/cash.controller.js";

const router = express.Router();

// حركات النقدية العادية (المستخدم يسجل لحسابه/فرعه)
router.post("/", authMiddleware, permit("admin","accountant","storekeeper"), createCashMovement);
router.get("/", authMiddleware, permit("admin","accountant"), listCash);

// نظام الفلوس اليومي
router.post("/daily-opening", authMiddleware, permit("admin","accountant"), dailyOpening);
router.post("/daily-closing", authMiddleware, permit("admin","accountant"), dailyClosing);
router.post("/transfer", authMiddleware, permit("admin","accountant","storekeeper"), cashTransfer);

// مصالحة الفروع (admin-only)
router.post("/reconcile", authMiddleware, permit("admin"), reconcile);

// إدارة الحركات المتقدمة
router.get("/:id", authMiddleware, permit("admin","accountant"), getMovement); // جلب حركة محددة
router.patch("/:id", authMiddleware, permit("admin","accountant"), updateMovement); // تعديل حركة
router.post("/:id/reverse", authMiddleware, permit("admin","accountant"), reverseMovement); // عكس حركة

export default router;