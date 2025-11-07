import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { createProduct, listProducts, getProduct, moveStock } from "../controllers/products.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createProductSchema } from "../validators/product.validator.js";

const router = express.Router();
router.get("/", authMiddleware, listProducts);
router.post("/", authMiddleware, permit("admin","storekeeper"), validate(createProductSchema), createProduct);
router.get("/:id", authMiddleware, getProduct);
router.post("/move", authMiddleware, permit("admin","storekeeper","employee"), moveStock);

export default router;
