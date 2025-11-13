// src/api/validators/inventoryCount.validator.js
import Joi from 'joi';

export const createInventoryCountSchema = Joi.object({
  title: Joi.string().required().messages({
    'string.empty': 'عنوان الجرد مطلوب',
    'any.required': 'عنوان الجرد مطلوب'
  }),
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  }),
  type: Joi.string().valid('scheduled', 'spot', 'periodic', 'full').default('scheduled').messages({
    'any.only': 'نوع الجرد يجب أن يكون scheduled أو spot أو periodic أو full'
  }),
  countDate: Joi.date().default(Date.now).messages({
    'date.base': 'تاريخ الجرد يجب أن يكون تاريخ صحيح'
  }),
  notes: Joi.string().allow('').optional()
});

export const updateProductCountSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.empty': 'معرف المنتج مطلوب',
    'any.required': 'معرف المنتج مطلوب'
  }),
  actualCount: Joi.number().integer().min(0).required().messages({
    'number.base': 'العدد الفعلي يجب أن يكون رقم',
    'number.min': 'العدد الفعلي يجب أن يكون صفر أو أكثر',
    'any.required': 'العدد الفعلي مطلوب'
  }),
  notes: Joi.string().allow('').optional()
});

export const approveInventoryCountSchema = Joi.object({
  adjustmentNotes: Joi.string().allow('').optional(),
  autoAdjust: Joi.boolean().default(false).messages({
    'boolean.base': 'autoAdjust يجب أن تكون true أو false'
  })
});

export const quickCountSchema = Joi.object({
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  }),
  productId: Joi.string().required().messages({
    'string.empty': 'معرف المنتج مطلوب',
    'any.required': 'معرف المنتج مطلوب'
  }),
  actualCount: Joi.number().integer().min(0).required().messages({
    'number.base': 'العدد الفعلي يجب أن يكون رقم',
    'number.min': 'العدد الفعلي يجب أن يكون صفر أو أكثر',
    'any.required': 'العدد الفعلي مطلوب'
  }),
  notes: Joi.string().allow('').optional()
});

export const inventoryReportSchema = Joi.object({
  startDate: Joi.date().optional().messages({
    'date.base': 'تاريخ البداية يجب أن يكون تاريخ صحيح'
  }),
  endDate: Joi.date().optional().messages({
    'date.base': 'تاريخ النهاية يجب أن يكون تاريخ صحيح'
  }),
  branch: Joi.string().optional()
});