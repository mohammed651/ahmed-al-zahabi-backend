import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { createProduct, listProducts, getProduct, moveStock } from "../controllers/products.controller.js";

const router = express.Router();
router.get("/", authMiddleware, listProducts);
router.post("/", authMiddleware, permit("admin","storekeeper"), createProduct);
router.get("/:id", authMiddleware, getProduct);
router.post("/move", authMiddleware, permit("admin","storekeeper","employee"), moveStock);

export default router;
