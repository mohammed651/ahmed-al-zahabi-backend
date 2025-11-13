import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import {
  createElectronicAccount,
  updateElectronicAccount,
  deleteElectronicAccount,
  getElectronicAccounts,
  transferToCash,
  depositToElectronic
} from "../controllers/electronic.controller.js";

const router = express.Router();

// إدارة حسابات الدفع الإلكتروني
router.post("/accounts", authMiddleware, permit("admin", "accountant"), createElectronicAccount);
router.put("/accounts/:id", authMiddleware, permit("admin", "accountant"), updateElectronicAccount);
router.delete("/accounts/:id", authMiddleware, permit("admin", "accountant"), deleteElectronicAccount);
router.get("/accounts", authMiddleware, permit("admin", "accountant", "storekeeper"), getElectronicAccounts);

// التحويلات
router.post("/transfer-to-cash", authMiddleware, permit("admin", "accountant"), transferToCash);
router.post("/deposit", authMiddleware, permit("admin", "accountant"), depositToElectronic);

export default router;