// src/api/routes/advancedReports.routes.js
import express from "express";
import {
  getProfitLossReport,
  getSalesAnalysisReport,
  getInventoryAnalysisReport,
  getDashboardStats
} from "../controllers/advancedReports.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();

router.get("/profit-loss", 
  authMiddleware, 
  permit("admin", "accountant"), 
  getProfitLossReport
);

router.get("/sales-analysis", 
  authMiddleware, 
  permit("admin", "accountant"), 
  getSalesAnalysisReport
);

router.get("/inventory-analysis", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper"), 
  getInventoryAnalysisReport
);

router.get("/dashboard-stats", 
  authMiddleware, 
  permit("admin", "accountant", "storekeeper"), 
  getDashboardStats
);

export default router;