// src/api/routes/scrap.routes.js
import express from "express";
import {
  receiveScrap,
  moveScrap,
  consumeScrap,
  sellScrapToTrader,
  listStores,
  listTransactions
} from "../controllers/scrap.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  receiveScrapSchema,
  moveScrapSchema,
  consumeScrapSchema,
  sellScrapSchema
} from "../validators/scrap.validator.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();

// only authenticated users can operate; permit roles as you like:
router.post("/receive", authMiddleware, permit("admin","storekeeper","employee"), validate(receiveScrapSchema), receiveScrap);
router.post("/move", authMiddleware, permit("admin","storekeeper"), validate(moveScrapSchema), moveScrap);
router.post("/consume", authMiddleware, permit("admin","storekeeper"), validate(consumeScrapSchema), consumeScrap);
router.post("/sell", authMiddleware, permit("admin","storekeeper","accountant"), validate(sellScrapSchema), sellScrapToTrader);

router.get("/stores", authMiddleware, permit("admin","accountant","storekeeper"), listStores);
router.get("/transactions", authMiddleware, permit("admin","accountant","storekeeper"), listTransactions);

export default router;
