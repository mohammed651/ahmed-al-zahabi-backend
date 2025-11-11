import Joi from 'joi';

export const createProductSchema = Joi.object({
  code: Joi.string().max(50),
  name: Joi.string().max(200).required(),
  category: Joi.string().allow('', null),
  karat: Joi.number().integer().min(1).max(24).optional(),
  weight: Joi.number().precision(3).min(0).optional(),
  pricePerGram: Joi.number().precision(3).min(0).optional(),
  count_in_store: Joi.number().integer().min(0).default(0),
  count_in_showcase: Joi.number().integer().min(0).default(0),
  images: Joi.array().items(Joi.string().uri()).optional()
});
