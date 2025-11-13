import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { 
  createCashMovement, 
  listCash, 
  dailyOpening,
  dailyClosing,
  cashTransfer 
} from "../controllers/cash.controller.js";

const router = express.Router();

// حركات النقدية العادية
router.post("/", authMiddleware, permit("admin","accountant","storekeeper"), createCashMovement);
router.get("/", authMiddleware, permit("admin","accountant"), listCash);

// نظام الفلوس اليومي (جديد)
router.post("/daily-opening", authMiddleware, permit("admin","accountant"), dailyOpening);
router.post("/daily-closing", authMiddleware, permit("admin","accountant"), dailyClosing);
router.post("/transfer", authMiddleware, permit("admin","accountant"), cashTransfer);

export default router;