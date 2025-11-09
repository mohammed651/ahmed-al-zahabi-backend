// src/api/validators/auth.validator.js
import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "any.required": "الاسم مطلوب",
    "string.empty": "الاسم مطلوب"
  }),
  username: Joi.string().min(3).max(50).required().messages({
    "any.required": "اسم المستخدم مطلوب"
  }),
  password: Joi.string().min(6).max(200).required().messages({
    "any.required": "كلمة المرور مطلوبة",
    "string.min": "كلمة المرور على الأقل 6 أحرف"
  }),
  role: Joi.string().valid("admin", "accountant", "storekeeper", "employee").optional(),
  branch: Joi.string().optional()
});

export const loginSchema = Joi.object({
  username: Joi.string().required().messages({ "any.required": "اسم المستخدم مطلوب" }),
  password: Joi.string().required().messages({ "any.required": "كلمة المرور مطلوبة" })
});
