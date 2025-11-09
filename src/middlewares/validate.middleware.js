// src/middlewares/validate.middleware.js
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => d.message);
      return res.status(400).json({ success: false, message: "بيانات غير صحيحة", details });
    }
    req.body = value;
    next();
  };
}
