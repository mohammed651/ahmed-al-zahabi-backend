// src/api/routes/branch.routes.js
import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { 
  getBranches,
  getBranch,
  getUserBranch,
  updateBranchBalance,
  createBranch
} from "../controllers/branch.controller.js";

const router = express.Router();

// جميع المستخدمين يمكنهم رؤية الفروع (حسب الصلاحيات)
router.get("/", authMiddleware, permit("admin", "accountant", "storekeeper", "employee"), getBranches);

// جلب فرع محدد بالكود
router.get("/:code", authMiddleware, permit("admin", "accountant", "storekeeper", "employee"), getBranch);

// جلب فرع المستخدم الحالي
router.get("/user/current", authMiddleware, permit("admin", "accountant", "storekeeper", "employee"), getUserBranch);

// تحديث رصيد فرع (للمحاسبين والأدمن فقط)
router.patch("/:code/balance", authMiddleware, permit("admin", "accountant"), updateBranchBalance);

// إنشاء فرع جديد (للأدمن فقط)
router.post("/", authMiddleware, permit("admin"), createBranch);

export default router;