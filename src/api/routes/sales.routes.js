// src/api/routes/sales.routes.js
import express from "express";
import {
  createSale,
  createQuickSale,
  listSales,
  getSale,
  getSaleByInvoiceNo,
  updateSaleStatus,
  deleteSale,
  getSalesReport,
  purchaseScrap,
  getMySales,
  updateSale
} from "../controllers/sales.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createSaleSchema,
  createQuickSaleSchema,
  purchaseScrapSchema,
  salesReportSchema,
  updateSaleSchema
} from "../validators/sale.validator.js";

const router = express.Router();

// إنشاء فاتورة بيع عادية
router.post("/", 
  authMiddleware, 
  permit("admin", "accountant", "employee"), 
  validate(createSaleSchema), 
  createSale
);

// إنشاء فاتورة بيع سريعة
router.post("/quick", 
  authMiddleware, 
  permit("admin", "accountant", "employee"), 
  validate(createQuickSaleSchema), 
  createQuickSale
);

// شراء كسر منفصل
router.post("/purchase-scrap", 
  authMiddleware, 
  permit("admin", "accountant", "employee"), 
  validate(purchaseScrapSchema), 
  purchaseScrap
);

// قائمة الفواتير
router.get("/", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper"), 
  listSales
);

// تقرير المبيعات
router.get("/report", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(salesReportSchema, "query"), 
  getSalesReport
);

// الحصول على فاتورة بالرقم
router.get("/invoice/:invoiceNo", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper", "employee"), 
  getSaleByInvoiceNo
);

// فواتيري الشخصية
router.get("/my-sales", 
  authMiddleware, 
  permit("admin", "accountant", "employee"),
  getMySales
);

// الحصول على فاتورة بالID
router.get("/:id", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper", "employee"), 
  getSale
);

// تحديث حالة الفاتورة
router.patch("/:id/status", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(updateSaleSchema), 
  updateSaleStatus
);

// حذف الفاتورة
router.delete("/:id", 
  authMiddleware, 
  permit("admin", "accountant"), 
  deleteSale
);

// تحديث الفاتورة (استبدال كامل للفاتورة المرسلة)
router.put("/:id", 
  authMiddleware, 
  permit("admin", "accountant"), 
  validate(updateSaleSchema), 
  updateSale
);

export default router;
