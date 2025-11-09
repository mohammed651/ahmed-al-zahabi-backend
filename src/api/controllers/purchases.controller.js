// src/api/controllers/purchases.controller.js
import mongoose from "mongoose";
import Purchase from "../../models/Purchase.js";
import Supplier from "../../models/Supplier.js";
import SupplierTransaction from "../../models/SupplierTransaction.js";
import Branch from "../../models/Branch.js";
import CashMovement from "../../models/CashMovement.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { success, error } from "../../utils/responses.js";

/**
 * Create Purchase
 * - Creates Purchase document
 * - If type === 'cash' -> create CashMovement (expense) and decrement Branch.cash_balance
 * - If type === 'gold' -> increase Supplier.balanceGrams and create SupplierTransaction (debt in grams)
 * - Update product counts (if items contain product references) and create StockMovement entries
 *
 * Expects request body similar to your Purchase model:
 * {
 *   supplier: "<supplierId>",
 *   branch: "main",
 *   items: [{ product, weight, pricePerGram, quantity, subtotal }, ...],
 *   total: 1000,         // for cash -> amount; for gold -> grams (per agreed convention)
 *   type: "cash"|"gold"
 * }
 */
export async function createPurchase(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { supplier: supplierId, branch, items = [], total = 0, type = "cash" } = req.body;

    // validate supplier
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("المورد غير موجود");

    // create purchase record
    const purchaseDoc = await Purchase.create([{
      supplier: supplierId,
      branch,
      items: items.map(it => ({
        product: it.product || null,
        weight: it.weight != null ? mongoose.Types.Decimal128.fromString(String(it.weight)) : mongoose.Types.Decimal128.fromString("0"),
        pricePerGram: it.pricePerGram != null ? mongoose.Types.Decimal128.fromString(String(it.pricePerGram)) : mongoose.Types.Decimal128.fromString("0"),
        quantity: it.quantity || 1,
        subtotal: it.subtotal != null ? mongoose.Types.Decimal128.fromString(String(it.subtotal)) : mongoose.Types.Decimal128.fromString("0")
      })),
      total: mongoose.Types.Decimal128.fromString(String(total || 0)),
      type,
      createdBy: req.user?._id
    }], { session });

    const purchase = purchaseDoc[0];

    // Payment effects
    if (type === "cash") {
      // create cash movement (expense)
      await CashMovement.create([{
        branch,
        type: "expense",
        amount: mongoose.Types.Decimal128.fromString(String(total || 0)),
        source_branch: null,
        reason: `شراء من مورد - ${supplier.name} - ${purchase._id}`,
        user: req.user?._id
      }], { session });

      // update branch cash_balance (subtract)
      const br = await Branch.findOne({ name: branch }).session(session);
      if (br) {
        const cur = Number(br.cash_balance?.toString() || 0);
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(cur - Number(total || 0)));
        await br.save({ session });
      }
    } else if (type === "gold") {
      // treat total as grams (as agreed) => increase supplier.balanceGrams
      const currG = Number(supplier.balanceGrams?.toString() || 0);
      supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(currG + Number(total || 0)));
      await supplier.save({ session });

      // create supplier transaction (debt in grams) for audit
      await SupplierTransaction.create([{
        supplier: supplier._id,
        type: "debt",
        amountCash: mongoose.Types.Decimal128.fromString("0"),
        amountGrams: mongoose.Types.Decimal128.fromString(String(total || 0)),
        direction: "in",
        method: "purchase",
        note: `دين جرامات - شراء من مورد - ${purchase._id}`,
        recordedBy: req.user?._id
      }], { session });
    }

    // Update inventory for referenced products and create StockMovement entries
    for (const it of items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (prod) {
          const qty = Number(it.quantity || 1);
          prod.count_in_store = (Number(prod.count_in_store || 0) + qty);
          await prod.save({ session });

          await StockMovement.create([{
            product: prod._id,
            type: "in",
            from: "supplier",
            to: "store",
            quantity: qty,
            note: `استلام شراء - ${purchase._id}`,
            performedByEmployeeName: req.user?.name,
            recordedBy: req.user?._id
          }], { session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, purchase, "تم إنشاء عملية الشراء ومعالجة الحركات", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إنشاء الشراء", 400, err.message);
  }
}

export async function listPurchases(req, res) {
  const items = await Purchase.find().populate("supplier createdBy").sort({ createdAt: -1 });
  return success(res, items, "قائمة المشتريات");
}

export async function getPurchase(req, res) {
  const p = await Purchase.findById(req.params.id).populate("supplier createdBy");
  if (!p) return error(res, "عملية الشراء غير موجودة", 404);
  return success(res, p, "عملية الشراء");
}
