// src/api/validators/sales.validator.js
import Joi from 'joi';

// Validator للبيع العادي
export const createSaleSchema = Joi.object({
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  }),
  items: Joi.array().items(
    Joi.object({
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
      })
    })
  ).min(1).required().messages({
    'array.min': 'يجب إضافة منتج واحد على الأقل',
    'any.required': 'المنتجات مطلوبة'
  }),
  customer: Joi.object({
    name: Joi.string().allow('').optional(),
    phone: Joi.string().allow('').optional()
  }).optional(),
  payment: Joi.object({
    method: Joi.string().valid('cash', 'electronic', 'installment').required().messages({
      'any.only': 'طريقة الدفع يجب أن تكون cash أو electronic أو installment',
      'any.required': 'طريقة الدفع مطلوبة'
    }),
    electronicAccount: Joi.string().optional().when('method', {
      is: 'electronic',
      then: Joi.required().messages({
        'any.required': 'الحساب الإلكتروني مطلوب للدفع الإلكتروني'
      })
    }),
    installmentDetails: Joi.object({
      months: Joi.number().integer().min(1).max(36).required(),
      monthlyPayment: Joi.number().precision(2).min(0).required()
    }).optional().when('method', {
      is: 'installment',
      then: Joi.required().messages({
        'any.required': 'تفاصيل التقسيط مطلوبة للدفع بالتقسيط'
      })
    })
  }).required(),
  exchangedScrap: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'وصف السكراب مطلوب'
      }),
      karat: Joi.number().integer().min(18).max(24).required().messages({
        'number.base': 'عيار السكراب يجب أن يكون رقم',
        'number.min': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'number.max': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'any.required': 'عيار السكراب مطلوب'
      }),
      weight: Joi.number().precision(3).min(0.001).required().messages({
        'number.base': 'وزن السكراب يجب أن يكون رقم',
        'number.min': 'وزن السكراب يجب أن يكون أكبر من صفر',
        'any.required': 'وزن السكراب مطلوب'
      }),
      pricePerGram: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر جرام السكراب يجب أن يكون رقم',
        'number.min': 'سعر جرام السكراب يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر جرام السكراب مطلوب'
      })
    })
  ).default([]),
  additionalServices: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'اسم الخدمة مطلوب'
      }),
      price: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر الخدمة يجب أن يكون رقم',
        'number.min': 'سعر الخدمة يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر الخدمة مطلوب'
      }),
      icon: Joi.string().optional(),
      type: Joi.string().valid('fixed', 'custom').default('fixed')
    })
  ).default([]),
  manualDiscount: Joi.number().precision(2).min(0).default(0).messages({
    'number.base': 'الخصم اليدوي يجب أن يكون رقم',
    'number.min': 'الخصم اليدوي يجب أن يكون صفر أو أكثر'
  }),
  notes: Joi.string().allow('').optional()
});

// Validator للبيع السريع
export const createQuickSaleSchema = Joi.object({
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  }),
  items: Joi.array().items(
    Joi.object({
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
      })
    })
  ).min(1).required().messages({
    'array.min': 'يجب إضافة منتج واحد على الأقل',
    'any.required': 'المنتجات مطلوبة'
  }),
  customer: Joi.object({
    name: Joi.string().allow('').optional(),
    phone: Joi.string().allow('').optional()
  }).optional(),
  paymentMethod: Joi.string().valid('cash', 'electronic').default('cash').messages({
    'any.only': 'طريقة الدفع يجب أن تكون cash أو electronic'
  }),
  electronicAccount: Joi.string().optional(),
  exchangedScrap: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'وصف السكراب مطلوب'
      }),
      karat: Joi.number().integer().min(18).max(24).required().messages({
        'number.base': 'عيار السكراب يجب أن يكون رقم',
        'number.min': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'number.max': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'any.required': 'عيار السكراب مطلوب'
      }),
      weight: Joi.number().precision(3).min(0.001).required().messages({
        'number.base': 'وزن السكراب يجب أن يكون رقم',
        'number.min': 'وزن السكراب يجب أن يكون أكبر من صفر',
        'any.required': 'وزن السكراب مطلوب'
      }),
      pricePerGram: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر جرام السكراب يجب أن يكون رقم',
        'number.min': 'سعر جرام السكراب يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر جرام السكراب مطلوب'
      })
    })
  ).default([]),
  additionalServices: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'اسم الخدمة مطلوب'
      }),
      price: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر الخدمة يجب أن يكون رقم',
        'number.min': 'سعر الخدمة يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر الخدمة مطلوب'
      }),
      icon: Joi.string().optional()
    })
  ).default([]),
  manualDiscount: Joi.number().precision(2).min(0).default(0).messages({
    'number.base': 'الخصم اليدوي يجب أن يكون رقم',
    'number.min': 'الخصم اليدوي يجب أن يكون صفر أو أكثر'
  })
});

// Validator لشراء الكسر المنفصل
export const purchaseScrapSchema = Joi.object({
  branch: Joi.string().required().messages({
    'string.empty': 'الفرع مطلوب',
    'any.required': 'الفرع مطلوب'
  }),
  scrapDetails: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'وصف السكراب مطلوب'
      }),
      karat: Joi.number().integer().min(18).max(24).required().messages({
        'number.base': 'عيار السكراب يجب أن يكون رقم',
        'number.min': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'number.max': 'عيار السكراب يجب أن يكون 18 أو 21 أو 24',
        'any.required': 'عيار السكراب مطلوب'
      }),
      weight: Joi.number().precision(3).min(0.001).required().messages({
        'number.base': 'وزن السكراب يجب أن يكون رقم',
        'number.min': 'وزن السكراب يجب أن يكون أكبر من صفر',
        'any.required': 'وزن السكراب مطلوب'
      }),
      pricePerGram: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'سعر جرام السكراب يجب أن يكون رقم',
        'number.min': 'سعر جرام السكراب يجب أن يكون صفر أو أكثر',
        'any.required': 'سعر جرام السكراب مطلوب'
      })
    })
  ).min(1).required().messages({
    'array.min': 'يجب إضافة نوع كسر واحد على الأقل',
    'any.required': 'بيانات السكراب مطلوبة'
  }),
  customer: Joi.object({
    name: Joi.string().allow('').optional(),
    phone: Joi.string().allow('').optional()
  }).optional(),
  payment: Joi.object({
    method: Joi.string().valid('cash', 'electronic').required().messages({
      'any.only': 'طريقة الدفع يجب أن تكون cash أو electronic',
      'any.required': 'طريقة الدفع مطلوبة'
    }),
    electronicAccount: Joi.string().optional().when('method', {
      is: 'electronic',
      then: Joi.required().messages({
        'any.required': 'الحساب الإلكتروني مطلوب للدفع الإلكتروني'
      })
    })
  }).required()
});

// Validator لتقرير المبيعات
export const salesReportSchema = Joi.object({
  startDate: Joi.date().optional().messages({
    'date.base': 'تاريخ البداية يجب أن يكون تاريخ صحيح'
  }),
  endDate: Joi.date().optional().messages({
    'date.base': 'تاريخ النهاية يجب أن يكون تاريخ صحيح'
  }),
  branch: Joi.string().optional(),
  paymentMethod: Joi.string().valid('cash', 'electronic', 'installment').optional().messages({
    'any.only': 'طريقة الدفع يجب أن تكون cash أو electronic أو installment'
  }),
  status: Joi.string().valid('draft', 'pending', 'paid', 'cancelled').optional().messages({
    'any.only': 'حالة الفاتورة يجب أن تكون draft أو pending أو paid أو cancelled'
  })
});

// Validator لتحديث حالة الفاتورة
export const updateSaleSchema = Joi.object({
  status: Joi.string().valid('draft', 'pending', 'paid', 'cancelled').required().messages({
    'any.only': 'حالة الفاتورة يجب أن تكون draft أو pending أو paid أو cancelled',
    'any.required': 'حالة الفاتورة مطلوبة'
  })
});