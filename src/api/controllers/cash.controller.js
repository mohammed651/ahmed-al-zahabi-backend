import CashMovement from "../../models/CashMovement.js";
import { success } from "../../utils/responses.js";

export async function createCashMovement(req, res) {
  const data = req.body;
  data.user = req.user._id;
  const mv = await CashMovement.create(data);
  return success(res, mv, "تم تسجيل حركة نقدية", 201);
}

export async function listCash(req, res) {
  const items = await CashMovement.find().populate("user").sort({ createdAt: -1 });
  return success(res, items, "حركات النقد");
}
