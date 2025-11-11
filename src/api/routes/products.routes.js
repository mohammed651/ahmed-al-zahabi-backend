import express from "express";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  moveStock,
  getProductByCode,
  updateProductByCode,
  deleteProductByCode,
  moveStockSimple
} from "../controllers/products.controller.js";

const router = express.Router();

// Routes بالـ ID
router.post("/", createProduct);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

// Routes جديدة بالـ code
router.get("/code/:code", getProductByCode);
router.put("/code/:code", updateProductByCode);
router.delete("/code/:code", deleteProductByCode);

// Routes أخرى
router.post("/move", moveStock);
router.post("/move-simple", moveStockSimple);

export default router;