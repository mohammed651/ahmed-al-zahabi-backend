// src/api/routes/returns.routes.js
import express from "express";
import {
  createReturn,
  approveReturn,
  rejectReturn,
  listReturns,
  getReturn,
  cancelReturn,
  getReturnsReport
} from "../controllers/returns.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createReturnSchema,
  approveReturnSchema,
  rejectReturnSchema,
  returnsReportSchema
} from "../validators/returns.validator.js";

const router = express.Router();

// إنشاء طلب إرجاع
router.post("/", 
  authMiddleware, 
  permit("admin", "accountant", "employee"), 
  validate(createReturnSchema), 
  createReturn
);

// الموافقة على طلب إرجاع
router.patch("/:id/approve", 
  authMiddleware, 
  permit("admin", "accountant"), 
  approveReturn
);

// رفض طلب إرجاع
router.patch("/:id/reject", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(rejectReturnSchema), 
  rejectReturn
);

// إلغاء طلب إرجاع
router.patch("/:id/cancel", 
  authMiddleware, 
  permit("admin", "accountant", "employee"), 
  cancelReturn
);

// قائمة طلبات الإرجاع
router.get("/", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper"), 
  listReturns
);

// تقرير المرتجعات
router.get("/report", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(returnsReportSchema, "query"), 
  getReturnsReport
);

// الحصول على طلب إرجاع معين
router.get("/:id", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper", "employee"), 
  getReturn
);

export default router;