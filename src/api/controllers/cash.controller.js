import CashMovement from "../../models/CashMovement.js";
import DailyCash from "../../models/DailyCash.js";
import Branch from "../../models/Branch.js";
import { success, error } from "../../utils/responses.js";

export async function dailyOpening(req, res) {
  try {
    const { branch, openingBills } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const existing = await DailyCash.findOne({ 
      branch, 
      date: { $gte: new Date(today) } 
    });
    
    if (existing) {
      return error(res, "تم فتح اليوم مسبقاً لهذا الفرع", 400);
    }

    const total = calculateTotalFromBills(openingBills);
    
    const dailyCash = await DailyCash.create({
      branch,
      date: new Date(),
      openingBills,
      openingTotal: total,
      status: "open",
      recordedBy: req.user._id
    });

    return success(res, dailyCash, "تم فتح اليوم بنجاح", 201);
  } catch (err) {
    return error(res, "فشل في فتح اليوم", 400, err.message);
  }
}

export async function cashTransfer(req, res) {
  try {
    const { fromType, fromBranch, fromSource, toType, toBranch, toSource, amount, notes } = req.body;

    if ((fromType === "external" || toType === "external") && !notes) {
      return error(res, "الملاحظات إجبارية للتحويل من/لمصدر خارجي", 400);
    }

    const transfer = await CashMovement.create({
      branch: fromType === "branch" ? fromBranch : toBranch,
      type: "transfer",
      fromType, fromBranch, fromSource,
      toType, toBranch, toSource,
      amount,
      notes,
      user: req.user._id
    });

    return success(res, transfer, "تم التحويل بنجاح", 201);
  } catch (err) {
    return error(res, "فشل في التحويل", 400, err.message);
  }
}

export async function dailyClosing(req, res) {
  try {
    const { branch, closingBills, storeTransfers = [] } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const dailyCash = await DailyCash.findOne({ 
      branch, 
      date: { $gte: new Date(today) },
      status: "open"
    });
    
    if (!dailyCash) {
      return error(res, "لم يتم فتح اليوم لهذا الفرع", 400);
    }

    const closingTotal = calculateTotalFromBills(closingBills);
    
    dailyCash.closingBills = closingBills;
    dailyCash.closingTotal = closingTotal;
    dailyCash.storeTransfers = storeTransfers;
    dailyCash.status = "closed";
    
    await dailyCash.save();

    return success(res, dailyCash, "تم غلق اليوم بنجاح");
  } catch (err) {
    return error(res, "فشل في غلق اليوم", 400, err.message);
  }
}

function calculateTotalFromBills(bills) {
  const total = (bills["200"] || 0) * 200 +
               (bills["100"] || 0) * 100 +
               (bills["50"] || 0) * 50 +
               (bills["20"] || 0) * 20 +
               (bills["10"] || 0) * 10 +
               (bills["5"] || 0) * 5;
  return total;
}

// الدوال الحالية تبقى كما هي
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