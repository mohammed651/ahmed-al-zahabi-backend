// src/api/routes/suppliers.routes.js
import express from "express";
import {
  createSupplier,
  listSuppliers,
  getSupplier,
  updateSupplier,
  addDebt,
  paySupplier,
  adjustDebt,
  listSupplierTransactions,
  getSuppliersDebtReport
} from "../controllers/suppliers.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  addDebtSchema,
  paySupplierSchema,
  adjustDebtSchema
} from "../validators/suppliers.validator.js";

const router = express.Router();

// إنشاء تاجر جديد
router.post("/", 
  authMiddleware, 
  permit("admin","accountant"), 
  validate(createSupplierSchema), 
  createSupplier
);

// قائمة التجار
router.get("/", 
  authMiddleware, 
  permit("admin","accountant","storekeeper"), 
  listSuppliers
);

// بيانات تاجر
router.get("/:id", 
  authMiddleware, 
  permit("admin","accountant","storekeeper"), 
  getSupplier
);

// تحديث بيانات تاجر
router.put("/:id", 
  authMiddleware, 
  permit("admin","accountant"), 
  validate(updateSupplierSchema), 
  updateSupplier
);

// إضافة دين
router.post("/:id/debt", 
  authMiddleware, 
  permit("admin","accountant","storekeeper"), 
  validate(addDebtSchema), 
  addDebt
);

// سداد دين
router.post("/:id/pay", 
  authMiddleware, 
  permit("admin","accountant"), 
  validate(paySupplierSchema), 
  paySupplier
);

// تعديل دين
router.put("/:id/adjust", 
  authMiddleware, 
  permit("admin","accountant"), 
  validate(adjustDebtSchema), 
  adjustDebt
);

// حركات التاجر
router.get("/:id/transactions", 
  authMiddleware, 
  permit("admin","accountant","storekeeper"), 
  listSupplierTransactions
);

// تقرير الديون
router.get("/report/debts", 
  authMiddleware, 
  permit("admin","accountant","storekeeper"), 
  getSuppliersDebtReport
);

export default router;