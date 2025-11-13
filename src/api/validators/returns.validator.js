// src/api/validators/returns.validator.js
import Joi from 'joi';

export const createReturnSchema = Joi.object({
  originalSaleId: Joi.string().required().messages({
    'string.empty': 'معرف الفاتورة الأصلية مطلوب',
    'any.required': 'معرف الفاتورة الأصلية مطلوب'
  }),
  type: Joi.string().valid('full_return', 'partial_return', 'exchange').required().messages({
    'any.only': 'نوع الإرجاع يجب أن يكون full_return أو partial_return أو exchange',
    'any.required': 'نوع الإرجاع مطلوب'
  }),
  returnedItems: Joi.array().items(
    Joi.object({
      originalItem: Joi.string().required().messages({
        'string.empty': 'معرف العنصر الأصلي مطلوب',
        'any.required': 'معرف العنصر الأصلي مطلوب'
      }),
      product: Joi.string().optional(),
      productName: Joi.string().required().messages({
        'string.empty': 'اسم المنتج مطلوب'
      }),
      karat: Joi.number().integer().min(18).max(24).required().messages({
        'number.base': 'العيار يجب أن يكون رقم',
        'number.min': 'العيار يجب أن يكون 18 أو 21 أو 24',
        'number.max': 'العيار يجب أن يكون 18 أو 21 أو 24',
        'any.required': 'العيار مطلوب'
      }),
      weight: Joi.number().precision(3).min(0.001).required().messages({
        'number.base': 'الوزن يجب أن يكون رقم',
        'number.min': 'الوزن يجب أن يكون أكبر من صفر',
        'any.required': 'الوزن مطلوب'
      }),
      quantity: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'الكمية يجب أن تكون رقم',
        'number.min': 'الكمية يجب أن تكون 1 على الأقل'
      }),
      pricePerGram: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر الجرام يجب أن يكون رقم',
        'number.min': 'سعر الجرام يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر الجرام مطلوب'
      }),
      makingCost: Joi.number().precision(2).min(0).default(0).messages({
        'number.base': 'المصنعية يجب أن تكون رقم',
        'number.min': 'المصنعية يجب أن تكون صفر أو أكثر'
      }),
      reason: Joi.string().required().messages({
        'string.empty': 'سبب الإرجاع مطلوب',
        'any.required': 'سبب الإرجاع مطلوب'
      }),
      condition: Joi.string().valid('new', 'used', 'damaged').default('new').messages({
        'any.only': 'حالة المنتج يجب أن تكون new أو used أو damaged'
      })
    })
  ).min(1).required().messages({
    'array.min': 'يجب إضافة عنصر مرتجع واحد على الأقل',
    'any.required': 'العناصر المرتجعة مطلوبة'
  }),
  exchangeItems: Joi.array().items(
    Joi.object({
      product: Joi.string().optional(),
      productName: Joi.string().required().messages({
        'string.empty': 'اسم المنتج البديل مطلوب'
      }),
      karat: Joi.number().integer().min(18).max(24).required().messages({
        'number.base': 'عيار المنتج البديل يجب أن يكون رقم',
        'number.min': 'عيار المنتج البديل يجب أن يكون 18 أو 21 أو 24',
        'number.max': 'عيار المنتج البديل يجب أن يكون 18 أو 21 أو 24',
        'any.required': 'عيار المنتج البديل مطلوب'
      }),
      weight: Joi.number().precision(3).min(0.001).required().messages({
        'number.base': 'وزن المنتج البديل يجب أن يكون رقم',
        'number.min': 'وزن المنتج البديل يجب أن يكون أكبر من صفر',
        'any.required': 'وزن المنتج البديل مطلوب'
      }),
      quantity: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'كمية المنتج البديل يجب أن تكون رقم',
        'number.min': 'كمية المنتج البديل يجب أن تكون 1 على الأقل'
      }),
      pricePerGram: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر جرام المنتج البديل يجب أن يكون رقم',
        'number.min': 'سعر جرام المنتج البديل يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر جرام المنتج البديل مطلوب'
      }),
      makingCost: Joi.number().precision(2).min(0).default(0).messages({
        'number.base': 'مصنعية المنتج البديل يجب أن تكون رقم',
        'number.min': 'مصنعية المنتج البديل يجب أن تكون صفر أو أكثر'
      })
    })
  ).default([]),
  refund: Joi.object({
    method: Joi.string().valid('cash', 'electronic', 'credit').required().messages({
      'any.only': 'طريقة الاسترجاع يجب أن تكون cash أو electronic أو credit',
      'any.required': 'طريقة الاسترجاع مطلوبة'
    }),
    electronicAccount: Joi.string().optional().when('method', {
      is: 'electronic',
      then: Joi.required().messages({
        'any.required': 'الحساب الإلكتروني مطلوب للاسترجاع الإلكتروني'
      })
    })
  }).optional(),
  reason: Joi.string().optional(),
  notes: Joi.string().allow('').optional(),
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  })
});

export const approveReturnSchema = Joi.object({
  // يمكن إضافة حقول إضافية للموافقة إذا لزم
});

export const rejectReturnSchema = Joi.object({
  rejectionReason: Joi.string().required().messages({
    'string.empty': 'سبب الرفض مطلوب',
    'any.required': 'سبب الرفض مطلوب'
  })
});

export const returnsReportSchema = Joi.object({
  startDate: Joi.date().optional().messages({
    'date.base': 'تاريخ البداية يجب أن يكون تاريخ صحيح'
  }),
  endDate: Joi.date().optional().messages({
    'date.base': 'تاريخ النهاية يجب أن يكون تاريخ صحيح'
  }),
  branch: Joi.string().optional(),
  type: Joi.string().valid('full_return', 'partial_return', 'exchange').optional().messages({
    'any.only': 'نوع الإرجاع يجب أن يكون full_return أو partial_return أو exchange'
  })
});