import express from "express";
import { createSale, listSales } from "../controllers/sales.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createSaleSchema } from "../validators/sale.validator.js";

const router = express.Router();
router.post("/", authMiddleware, permit("admin","storekeeper","employee"), validate(createSaleSchema), createSale);
router.get("/", authMiddleware, permit("admin","accountant"), listSales);

export default router;
