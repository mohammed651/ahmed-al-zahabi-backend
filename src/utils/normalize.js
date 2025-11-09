// src/utils/normalize.js
export function normalizeDecimal(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeDecimal);
  if (typeof obj === "object") {
    // if mongoose doc, convert to plain object
    if (obj.toObject) obj = obj.toObject();
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && v._bsontype === "Decimal128") out[k] = v.toString();
      else out[k] = normalizeDecimal(v);
    }
    return out;
  }
  return obj;
}
