export function generateInvoiceNo() {
  const now = new Date();
  return `INV-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getTime().toString().slice(-6)}`;
}
