// src/api/routes/suppliers.routes.js
import express from "express";
import {
  createSupplier,
  listSuppliers,
  getSupplier,
  addDebt,
  paySupplier,
  listSupplierTransactions
} from "../controllers/suppliers.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

router.post("/", authMiddleware, permit("admin","accountant"), createSupplier);
router.get("/", authMiddleware, permit("admin","accountant","storekeeper"), listSuppliers);
router.get("/:id", authMiddleware, permit("admin","accountant","storekeeper"), getSupplier);

const debtSchema = Joi.object({
  amount: Joi.number().positive().required(),
  amountType: Joi.string().valid("cash","gold").required(),
  note: Joi.string().allow("", null)
});
router.post("/:id/debt", authMiddleware, permit("admin","accountant","storekeeper"), validate(debtSchema), addDebt);

const paySchema = Joi.object({
  amount: Joi.number().positive().required(),
  amountType: Joi.string().valid("cash","gold").required(),
  source: Joi.object({
    type: Joi.string().valid("cash","scrap").required(),
    branch: Joi.string().optional()
  }).optional(),
  note: Joi.string().allow("", null)
});
router.post("/:id/pay", authMiddleware, permit("admin","accountant"), validate(paySchema), paySupplier);

router.get("/:id/transactions", authMiddleware, permit("admin","accountant","storekeeper"), listSupplierTransactions);

export default router;
