// src/api/routes/purchases.routes.js
import express from "express";
import { createPurchase, listPurchases, getPurchase } from "../controllers/purchases.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, permit("admin","storekeeper","accountant"), createPurchase);
router.get("/", authMiddleware, permit("admin","accountant"), listPurchases);
router.get("/:id", authMiddleware, permit("admin","accountant"), getPurchase);

export default router;
