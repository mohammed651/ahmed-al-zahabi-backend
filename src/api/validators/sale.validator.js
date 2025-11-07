import Joi from 'joi';

const saleItem = Joi.object({
  product: Joi.string().required(),
  productName: Joi.string().optional(),
  karat: Joi.number().optional(),
  weight: Joi.number().precision(3).min(0).required(),
  quantity: Joi.number().integer().min(1).default(1),
  pricePerGram: Joi.number().precision(3).min(0).required(),
  makingCost: Joi.number().precision(3).min(0).default(0)
});

export const createSaleSchema = Joi.object({
  branch: Joi.string().required(),
  items: Joi.array().items(saleItem).min(1).required(),
  customer: Joi.object({
    name: Joi.string().allow('', null),
    phone: Joi.string().allow('', null)
  }).optional(),
  paymentMethod: Joi.string().valid('cash','card','credit').default('cash'),
  exchangedScrap: Joi.object({
    name: Joi.string(),
    karat: Joi.number(),
    weight: Joi.number().precision(3).min(0),
    pricePerGram: Joi.number().precision(3).min(0),
    total: Joi.number().precision(3).min(0)
  }).optional()
});
