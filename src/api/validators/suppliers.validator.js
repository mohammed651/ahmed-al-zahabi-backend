// src/api/validators/suppliers.validator.js
import Joi from "joi";

// دالة مساعدة للتحقق من أن أحد الحقلين على الأقل موجود
const atLeastOneRequired = (value, helpers) => {
  const { cashAmount, gramsAmount } = value;
  
  if (cashAmount === 0 && gramsAmount === 0) {
    return helpers.error('any.custom', {
      message: 'يجب إدخال مبلغ نقدي أو جرامات على الأقل'
    });
  }
  
  return value;
};

export const createSupplierSchema = Joi.object({
  name: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .messages({
      "any.required": "اسم التاجر مطلوب",
      "string.empty": "اسم التاجر لا يمكن أن يكون فارغاً",
      "string.min": "اسم التاجر يجب أن يكون على الأقل حرفين",
      "string.max": "اسم التاجر يجب أن لا يتجاوز 100 حرف"
    }),
  phone: Joi.string()
    .optional()
    .allow("")
    .pattern(/^[0-9+-\s()]{0,20}$/)
    .messages({
      "string.pattern.base": "رقم الهاتف غير صحيح"
    }),
  initialCashDebt: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .messages({
      "number.min": "الدين النقدي لا يمكن أن يكون سالباً",
      "number.precision": "الدين النقدي يجب أن يكون بحد أقصى منزلتين عشريتين"
    }),
  initialGramsDebt: Joi.number()
    .min(0)
    .precision(3)
    .default(0)
    .messages({
      "number.min": "الدين بالجرامات لا يمكن أن يكون سالباً",
      "number.precision": "الجرامات يجب أن تكون بحد أقصى 3 منازل عشرية"
    }),
  notes: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "الملاحظات يجب أن لا تتجاوز 500 حرف"
    })
});

export const updateSupplierSchema = Joi.object({
  name: Joi.string()
    .optional()
    .trim()
    .min(2)
    .max(100)
    .messages({
      "string.empty": "اسم التاجر لا يمكن أن يكون فارغاً",
      "string.min": "اسم التاجر يجب أن يكون على الأقل حرفين",
      "string.max": "اسم التاجر يجب أن لا يتجاوز 100 حرف"
    }),
  phone: Joi.string()
    .optional()
    .allow("")
    .pattern(/^[0-9+-\s()]{0,20}$/)
    .messages({
      "string.pattern.base": "رقم الهاتف غير صحيح"
    }),
  notes: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "الملاحظات يجب أن لا تتجاوز 500 حرف"
    }),
  isActive: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "حالة التاجر يجب أن تكون true أو false"
    })
});

export const addDebtSchema = Joi.object({
  cashAmount: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .messages({
      "number.min": "المبلغ النقدي لا يمكن أن يكون سالباً",
      "number.precision": "المبلغ النقدي يجب أن يكون بحد أقصى منزلتين عشريتين"
    }),
  gramsAmount: Joi.number()
    .min(0)
    .precision(3)
    .default(0)
    .messages({
      "number.min": "الجرامات لا يمكن أن تكون سالبة",
      "number.precision": "الجرامات يجب أن تكون بحد أقصى 3 منازل عشرية"
    }),
  note: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "الملاحظات يجب أن لا تتجاوز 500 حرف"
    })
}).custom(atLeastOneRequired);

export const paySupplierSchema = Joi.object({
  cashAmount: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .messages({
      "number.min": "المبلغ النقدي لا يمكن أن يكون سالباً",
      "number.precision": "المبلغ النقدي يجب أن يكون بحد أقصى منزلتين عشريتين"
    }),
  gramsAmount: Joi.number()
    .min(0)
    .precision(3)
    .default(0)
    .messages({
      "number.min": "الجرامات لا يمكن أن تكون سالبة",
      "number.precision": "الجرامات يجب أن تكون بحد أقصى 3 منازل عشرية"
    }),
  note: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "الملاحظات يجب أن لا تتجاوز 500 حرف"
    })
}).custom(atLeastOneRequired);

export const adjustDebtSchema = Joi.object({
  newCashBalance: Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
      "any.required": "الرصيد النقدي الجديد مطلوب",
      "number.min": "الرصيد النقدي لا يمكن أن يكون سالباً",
      "number.precision": "الرصيد النقدي يجب أن يكون بحد أقصى منزلتين عشريتين"
    }),
  newGramsBalance: Joi.number()
    .min(0)
    .precision(3)
    .required()
    .messages({
      "any.required": "الرصيد بالجرامات الجديد مطلوب",
      "number.min": "الرصيد بالجرامات لا يمكن أن يكون سالباً",
      "number.precision": "الجرامات يجب أن تكون بحد أقصى 3 منازل عشرية"
    }),
  reason: Joi.string()
    .required()
    .trim()
    .min(5)
    .max(500)
    .messages({
      "any.required": "سبب التعديل مطلوب",
      "string.empty": "سبب التعديل لا يمكن أن يكون فارغاً",
      "string.min": "سبب التعديل يجب أن يكون على الأقل 5 أحرف",
      "string.max": "سبب التعديل يجب أن لا يتجاوز 500 حرف"
    })
});