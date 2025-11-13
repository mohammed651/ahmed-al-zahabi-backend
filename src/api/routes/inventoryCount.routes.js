// src/api/routes/inventoryCount.routes.js
import express from "express";
import {
  createInventoryCount,
  updateProductCount,
  completeCounting,
  approveInventoryCount,
  listInventoryCounts,
  getInventoryCount,
  quickCount,
  getInventoryReport
} from "../controllers/inventoryCount.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createInventoryCountSchema,
  updateProductCountSchema,
  approveInventoryCountSchema,
  quickCountSchema,
  inventoryReportSchema
} from "../validators/inventoryCount.validator.js";

const router = express.Router();

// إنشاء جرد جديد
router.post("/", 
  authMiddleware, 
  permit("admin", "storekeeper"), 
  validate(createInventoryCountSchema), 
  createInventoryCount
);

// تحديث العدد الفعلي لمنتج
router.patch("/:id/count", 
  authMiddleware, 
  permit("admin", "storekeeper"), 
  validate(updateProductCountSchema), 
  updateProductCount
);

// إنهاء الجرد
router.patch("/:id/complete", 
  authMiddleware, 
  permit("admin", "storekeeper"), 
  completeCounting
);

// الموافقة على الجرد
router.patch("/:id/approve", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(approveInventoryCountSchema), 
  approveInventoryCount
);

// جرد سريع
router.post("/quick", 
  authMiddleware, 
  permit("admin", "storekeeper"), 
  validate(quickCountSchema), 
  quickCount
);

// قائمة عمليات الجرد
router.get("/", 
  authMiddleware, 
  permit("admin", "storekeeper", "accountant"), 
  listInventoryCounts
);

// تقرير الجرد
router.get("/report", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(inventoryReportSchema, "query"), 
  getInventoryReport
);

// الحصول على جرد معين
router.get("/:id", 
  authMiddleware, 
  permit("admin", "storekeeper", "accountant"), 
  getInventoryCount
);

export default router;