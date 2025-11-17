// utils/responses.js
import { normalizeDecimal } from "./normalize.js";

export function success(res, data = {}, message = "تمت العملية بنجاح", status = 200) {
  // 🔥 الحل النهائي: تحويل لـ JSON string ثم parse
  let processedData = data;
  
  // إذا كان data فيه _id (Mongoose document)
  if (data && typeof data === 'object' && data._id) {
    try {
      processedData = JSON.parse(JSON.stringify(data));
    } catch (error) {
      console.error('JSON serialization error:', error);
      processedData = data;
    }
  }
  
  const normalized = normalizeDecimal(processedData);
  return res.status(status).json({ success: true, message, data: normalized });
}

export function error(res, message = "حدث خطأ في الخادم", status = 500, details = null) {
  return res.status(status).json({ success: false, message, details });
}