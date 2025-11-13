// src/utils/generateReturnNumber.js
export function generateReturnNumber() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RET-${timestamp.slice(-6)}-${random}`;
}