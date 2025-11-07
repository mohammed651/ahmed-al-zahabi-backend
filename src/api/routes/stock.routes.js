import express from "express";
import { createMovement, listMovements } from "../controllers/stock.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();
router.post("/", authMiddleware, permit("admin","storekeeper","employee"), createMovement);
router.get("/", authMiddleware, listMovements);

export default router;
