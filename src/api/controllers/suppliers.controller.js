// src/api/controllers/suppliers.controller.js
import mongoose from "mongoose";
import Supplier from "../../models/Supplier.js";
import SupplierTransaction from "../../models/SupplierTransaction.js";
import Branch from "../../models/Branch.js";
import CashMovement from "../../models/CashMovement.js";
import { success, error } from "../../utils/responses.js";

/**
 * Create supplier (existing)
 */
export async function createSupplier(req, res) {
  try {
    const { name, phone, notes } = req.body;
    const s = await Supplier.create({ name, phone, notes });
    return success(res, s, "تم إنشاء المورد", 201);
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء المورد", 400, err.message);
  }
}

export async function listSuppliers(req, res) {
  const items = await Supplier.find().sort({ name: 1 });
  return success(res, items, "قائمة الموردين");
}

export async function getSupplier(req, res) {
  const s = await Supplier.findById(req.params.id);
  if (!s) return error(res, "المورد غير موجود", 404);
  // إضافة إجماليات سهلة القراءة
  const totalCash = Number(s.balanceCash?.toString() || 0);
  const totalGrams = Number(s.balanceGrams?.toString() || 0);
  return success(res, { supplier: s, totalCash, totalGrams }, "المورد");
}

/**
 * Add debt (increase supplier debt)
 * body: { amount: number, amountType: 'cash'|'gold', note }
 */
export async function addDebt(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const supplierId = req.params.id;
    const { amount = 0, amountType = "cash", note } = req.body;
    const amt = Number(amount || 0);
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("المورد غير موجود");

    if (amountType === "cash") {
      const curr = Number(supplier.balanceCash?.toString() || 0);
      supplier.balanceCash = mongoose.Types.Decimal128.fromString(String(curr + amt));
      await supplier.save({ session });

      await SupplierTransaction.create([{
        supplier: supplier._id,
        type: "debt",
        amountCash: mongoose.Types.Decimal128.fromString(String(amt)),
        amountGrams: mongoose.Types.Decimal128.fromString("0"),
        direction: "in",
        method: "manual_debt",
        note,
        recordedBy: req.user?._id
      }], { session });
    } else if (amountType === "gold") {
      const curr = Number(supplier.balanceGrams?.toString() || 0);
      supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(curr + amt));
      await supplier.save({ session });

      await SupplierTransaction.create([{
        supplier: supplier._id,
        type: "debt",
        amountCash: mongoose.Types.Decimal128.fromString("0"),
        amountGrams: mongoose.Types.Decimal128.fromString(String(amt)),
        direction: "in",
        method: "manual_debt",
        note,
        recordedBy: req.user?._id
      }], { session });
    } else {
      throw new Error("نوع المبلغ غير مدعوم");
    }

    await session.commitTransaction();
    session.endSession();
    return success(res, supplier, "تم إضافة الدين للمورد", 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إضافة الدين", 400, err.message);
  }
}

/**
 * Pay supplier (partial/full) — supports cash payments (from branch) or settlement with scrap (handled by caller)
 * body: { amount, amountType:'cash'|'gold', source: { type: 'cash'|'scrap', branch } , note }
 */
export async function paySupplier(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const supplierId = req.params.id;
    const { amount = 0, amountType = "cash", source = { type: "cash", branch: null }, note } = req.body;
    const amt = Number(amount || 0);
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("المورد غير موجود");

    if (amountType === "cash") {
      // decrease supplier cash balance
      const curr = Number(supplier.balanceCash?.toString() || 0);
      const newBal = Math.max(0, curr - amt);
      supplier.balanceCash = mongoose.Types.Decimal128.fromString(String(newBal));
      await supplier.save({ session });

      // if source is cash from branch: create cash movement and decrement branch cash_balance
      if (source && source.type === "cash") {
        const br = await Branch.findOne({ name: source.branch }).session(session);
        if (!br) throw new Error("الفرع غير موجود");
        const curBr = Number(br.cash_balance?.toString() || 0);
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(Math.max(0, curBr - amt)));
        await br.save({ session });

        await CashMovement.create([{
          branch: source.branch,
          type: "expense",
          amount: mongoose.Types.Decimal128.fromString(String(amt)),
          source_branch: null,
          reason: `سداد للمورد ${supplier.name}`,
          user: req.user?._id
        }], { session });

        // record supplier transaction
        await SupplierTransaction.create([{
          supplier: supplier._id,
          type: "payment",
          amountCash: mongoose.Types.Decimal128.fromString(String(amt)),
          amountGrams: mongoose.Types.Decimal128.fromString("0"),
          direction: "out",
          method: "settle_with_cash",
          note,
          recordedBy: req.user?._id
        }], { session });

      } else {
        // source not cash (e.g., manual), just record the payment
        await SupplierTransaction.create([{
          supplier: supplier._id,
          type: "payment",
          amountCash: mongoose.Types.Decimal128.fromString(String(amt)),
          amountGrams: mongoose.Types.Decimal128.fromString("0"),
          direction: "out",
          method: "manual_pay",
          note,
          recordedBy: req.user?._id
        }], { session });
      }

    } else if (amountType === "gold") {
      // pay in grams (e.g., give supplier grams back)
      const currG = Number(supplier.balanceGrams?.toString() || 0);
      const newBalG = Math.max(0, currG - amt);
      supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(newBalG));
      await supplier.save({ session });

      // record transaction (if source is scrap you can eventually call scrap controller)
      await SupplierTransaction.create([{
        supplier: supplier._id,
        type: "payment",
        amountCash: mongoose.Types.Decimal128.fromString("0"),
        amountGrams: mongoose.Types.Decimal128.fromString(String(amt)),
        direction: "out",
        method: source && source.type === "scrap" ? "settle_with_scrap" : "manual_pay",
        note,
        recordedBy: req.user?._id
      }], { session });
    } else {
      throw new Error("نوع المبلغ غير مدعوم");
    }

    await session.commitTransaction();
    session.endSession();
    return success(res, supplier, "تم سداد جزء/كل الدين للمورد", 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في سداد التاجر", 400, err.message);
  }
}

/**
 * List transactions for a supplier
 */
export async function listSupplierTransactions(req, res) {
  const supplierId = req.params.id;
  const { page = 1, limit = 50 } = req.query;
  const txs = await SupplierTransaction.find({ supplier: supplierId })
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(Number(limit));
  return success(res, txs, "حركات المورد");
}
