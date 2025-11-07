export function success(res, data = {}, message = "تمت العملية بنجاح", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function error(res, message = "حدث خطأ في الخادم", status = 500, details = null) {
  return res.status(status).json({ success: false, message, details });
}
