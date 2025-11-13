// src/api/routes/scrap.routes.js
import express from "express";
import {
  purchaseFromCustomer,
  addFromInvoice,
  addToStoreDirect,
  transferToStore,
  deductFromStore,
  moveBetweenStores,
  listStores,
  listTransactions,
  getTotalScrapReport,
  getDailyBranchReport,
  getCurrentBranchBalances,
  getStoreDetailedReport,
  getScrapSummaryByKarat,
  getScrapWithValueReport,
  getBranchPerformanceReport
} from "../controllers/scrap.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  purchaseScrapSchema,
  invoiceScrapSchema,
  directAddScrapSchema,
  transferScrapSchema,
  deductScrapSchema,
  moveScrapSchema
} from "../validators/scrap.validator.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();

// العمليات الأساسية
router.post("/purchase", authMiddleware, permit("admin","accountant","employee"), validate(purchaseScrapSchema), purchaseFromCustomer);
router.post("/invoice-add", authMiddleware, permit("admin","accountant"), validate(invoiceScrapSchema), addFromInvoice);
router.post("/direct-add", authMiddleware, permit("admin","storekeeper"), validate(directAddScrapSchema), addToStoreDirect);
router.post("/transfer", authMiddleware, permit("admin","accountant","employee"), validate(transferScrapSchema), transferToStore);
router.post("/deduct", authMiddleware, permit("admin","storekeeper"), validate(deductScrapSchema), deductFromStore);
router.post("/move", authMiddleware, permit("admin","storekeeper"), validate(moveScrapSchema), moveBetweenStores);

// التقارير
router.get("/stores", authMiddleware, permit("admin","accountant","storekeeper"), listStores);
router.get("/transactions", authMiddleware, permit("admin","accountant","storekeeper"), listTransactions);
router.get("/report/total", authMiddleware, permit("admin","accountant","storekeeper"), getTotalScrapReport);
router.get("/report/daily", authMiddleware, permit("admin","accountant","storekeeper"), getDailyBranchReport);
router.get("/report/balances", authMiddleware, permit("admin","accountant","storekeeper"), getCurrentBranchBalances);
router.get("/report/detailed", authMiddleware, permit("admin","accountant","storekeeper"), getStoreDetailedReport);
router.get("/report/summary", authMiddleware, permit("admin","accountant","storekeeper"), getScrapSummaryByKarat);
router.get("/report/value", authMiddleware, permit("admin","accountant","storekeeper"), getScrapWithValueReport);
router.get("/report/performance", authMiddleware, permit("admin","accountant","storekeeper"), getBranchPerformanceReport);

export default router;