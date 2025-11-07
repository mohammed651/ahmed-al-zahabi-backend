import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { createCashMovement, listCash } from "../controllers/cash.controller.js";

const router = express.Router();
router.post("/", authMiddleware, permit("admin","accountant","storekeeper"), createCashMovement);
router.get("/", authMiddleware, permit("admin","accountant"), listCash);

export default router;
