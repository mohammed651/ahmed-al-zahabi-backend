import express from "express";
import { createSale, listSales } from "../controllers/sales.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();
router.post("/", authMiddleware, permit("admin","storekeeper","employee"), createSale);
router.get("/", authMiddleware, permit("admin","accountant"), listSales);

export default router;
