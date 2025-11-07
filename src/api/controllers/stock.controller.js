import StockMovement from "../../models/StockMovement.js";
import { success } from "../../utils/responses.js";

export async function createMovement(req, res) {
  const data = req.body;
  data.recordedBy = req.user._id;
  const mv = await StockMovement.create(data);
  return success(res, mv, "تم تسجيل الحركة", 201);
}

export async function listMovements(req, res) {
  const items = await StockMovement.find().populate("product recordedBy").sort({ createdAt: -1 });
  return success(res, items, "حركات المخزون");
}
