// src/utils/generateCountNumber.js
export function generateCountNumber() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `COUNT-${timestamp.slice(-6)}-${random}`;
}