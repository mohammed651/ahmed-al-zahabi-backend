// src/api/validators/scrap.validator.js
import Joi from "joi";

export const purchaseScrapSchema = Joi.object({
  branch: Joi.string().required().messages({ "any.required": "الفرع مطلوب" }),
  karat: Joi.number().valid(18, 21, 24).required().messages({ "any.required": "العيار مطلوب" }),
  grams: Joi.number().positive().required().messages({ "any.required": "الوزن مطلوب" }),
  pricePerGram: Joi.number().positive().required().messages({ "any.required": "سعر الجرام مطلوب" }),
  customerName: Joi.string().optional(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const invoiceScrapSchema = Joi.object({
  branch: Joi.string().required(),
  karat: Joi.number().valid(18, 21, 24).required(),
  grams: Joi.number().positive().required(),
  invoiceNumber: Joi.string().required(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const directAddScrapSchema = Joi.object({
  branch: Joi.string().required().messages({ "any.required": "الفرع مطلوب" }),
  karat: Joi.number().valid(18, 21, 24).required().messages({ "any.required": "العيار مطلوب" }),
  grams: Joi.number().positive().required().messages({ "any.required": "الوزن مطلوب" }),
  source: Joi.string().required().messages({ "any.required": "مصدر الكسر مطلوب" }),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const transferScrapSchema = Joi.object({
  fromBranch: Joi.string().required().messages({ "any.required": "الفرع المصدر مطلوب" }),
  toBranch: Joi.string().required().messages({ "any.required": "الفرع الهدف مطلوب" }),
  karat: Joi.number().valid(18, 21, 24).required(),
  grams: Joi.number().positive().required(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const deductScrapSchema = Joi.object({
  branch: Joi.string().required(),
  karat: Joi.number().valid(18, 21, 24).required(),
  grams: Joi.number().positive().required(),
  destination: Joi.string().required().messages({ "any.required": "وجهة الخصم مطلوبة" }),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const moveScrapSchema = Joi.object({
  fromBranch: Joi.string().required(),
  toBranch: Joi.string().required(),
  karat: Joi.number().valid(18, 21, 24).required(),
  grams: Joi.number().positive().required(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

// التحويلات الجديدة
export const transferScrapSimpleSchema = Joi.object({
  fromBranch: Joi.string().required().messages({ "any.required": "الفرع المصدر مطلوب" }),
  toBranch: Joi.string().required().messages({ "any.required": "الفرع الهدف مطلوب" }),
  karat: Joi.number().valid(18, 21, 24).required().messages({ "any.required": "العيار مطلوب" }),
  grams: Joi.number().positive().required().messages({ "any.required": "الوزن مطلوب" }),
  notes: Joi.string().allow("", null)
});

export const transferAllToWarehouseSchema = Joi.object({
  fromBranch: Joi.string().required().messages({ "any.required": "الفرع المصدر مطلوب" })
});