// src/api/validators/scrap.validator.js
import Joi from "joi";

export const receiveScrapSchema = Joi.object({
  branch: Joi.string().required().messages({ "any.required": "الفرع مطلوب" }),
  karat: Joi.number().valid(18, 21, 24).required().messages({ "any.required": "العيار مطلوب" }),
  grams: Joi.number().positive().required().messages({ "any.required": "الوزن مطلوب" }),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const moveScrapSchema = Joi.object({
  from: Joi.string().required().messages({ "any.required": "المصدر مطلوب" }),
  to: Joi.string().required().messages({ "any.required": "الوجهة مطلوبة" }),
  karat: Joi.number().valid(18,21,24).required(),
  grams: Joi.number().positive().required(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});

export const consumeScrapSchema = Joi.object({
  branch: Joi.string().required(),
  karat: Joi.number().valid(18,21,24).required(),
  grams: Joi.number().positive().required(),
  reason: Joi.string().optional(),
  performedBy: Joi.string().optional()
});

export const sellScrapSchema = Joi.object({
  branch: Joi.string().required(),
  karat: Joi.number().valid(18,21,24).required(),
  grams: Joi.number().positive().required(),
  pricePerGram: Joi.number().positive().required(),
  traderId: Joi.string().optional(), // optional link to trader if you want, but not required
  performedBy: Joi.string().optional(),
  notes: Joi.string().allow("", null)
});
