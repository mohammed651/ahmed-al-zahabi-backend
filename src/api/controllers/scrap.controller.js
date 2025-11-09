// src/api/controllers/scrap.controller.js
import mongoose from "mongoose";
import ScrapStore from "../../models/ScrapStore.js";
import ScrapTransaction from "../../models/ScrapTransaction.js";
import { success, error } from "../../utils/responses.js";
import Product from "../../models/Product.js"; // إذا احتجنا لاحقًا

// helper: add grams to scrap store for given karat
async function addToStore(session, branch, karat, grams) {
  const store = await ScrapStore.findOne({ branch }).session(session);
  if (!store) {
    const s = new ScrapStore({ branch, totals: [{ karat, grams }] });
    await s.save({ session });
    return s;
  }
  // find karat entry
  const idx = store.totals.findIndex(t => t.karat === karat);
  if (idx === -1) {
    store.totals.push({ karat, grams });
  } else {
    const current = Number(store.totals[idx].grams.toString());
    store.totals[idx].grams = mongoose.Types.Decimal128.fromString(String(current + Number(grams)));
  }
  await store.save({ session });
  return store;
}

// helper: subtract grams from store (throws if insufficient)
async function subtractFromStore(session, branch, karat, grams) {
  const store = await ScrapStore.findOne({ branch }).session(session);
  if (!store) throw new Error("لا يوجد رصيد كسر في هذا الفرع");
  const idx = store.totals.findIndex(t => t.karat === karat);
  if (idx === -1) throw new Error("لا يوجد رصيد لهذا العيار");
  const current = Number(store.totals[idx].grams.toString());
  const need = Number(grams);
  if (current < need) throw new Error("الرصيد غير كافٍ");
  store.totals[idx].grams = mongoose.Types.Decimal128.fromString(String(current - need));
  await store.save({ session });
  return store;
}

export async function receiveScrap(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, performedBy, notes } = req.body;
    // add to scrap store
    await addToStore(session, branch, karat, grams);

    // create transaction record
    const tx = await ScrapTransaction.create([{
      type: "receive",
      branchTo: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم استلام الكسر وتسجيله", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في استلام الكسر", 400, err.message);
  }
}

export async function moveScrap(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { from, to, karat, grams, performedBy, notes } = req.body;
    // subtract from source
    await subtractFromStore(session, from, karat, grams);
    // add to destination
    await addToStore(session, to, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "move",
      branchFrom: from,
      branchTo: to,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم نقل الكسر بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في نقل الكسر", 400, err.message);
  }
}

export async function consumeScrap(req, res) {
  // consume: reduce scrap for some internal use (e.g., ملحوم, إعادة تصنيع)
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, reason, performedBy } = req.body;
    await subtractFromStore(session, branch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "consume",
      branchFrom: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      notes: reason
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم استهلاك الكسر", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في استهلاك الكسر", 400, err.message);
  }
}

export async function sellScrapToTrader(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, pricePerGram, traderId, performedBy, notes } = req.body;

    // subtract from store
    await subtractFromStore(session, branch, karat, grams);

    // create transaction record (sell_to_trader)
    const value = Number(pricePerGram) * Number(grams);
    const tx = await ScrapTransaction.create([{
      type: "sell_to_trader",
      branchFrom: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      value: mongoose.Types.Decimal128.fromString(String(value)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      relatedSupplierId: traderId || null,
      notes
    }], { session });

    /**
     * IMPORTANT: per your requirement, do NOT automatically update Supplier.balance_amount.
     * If you want to settle with supplier, use a separate explicit endpoint
     * (e.g., POST /api/suppliers/:id/settle-with-scrap) which will perform the supplier balance update.
     */

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم بيع الكسر لتاجر (سجل مستقل)", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في بيع الكسر", 400, err.message);
  }
}

export async function listStores(req, res) {
  const stores = await ScrapStore.find().sort({ branch: 1 });
  return success(res, stores, "قائمة أرصدة الكسر");
}

export async function listTransactions(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const txs = await ScrapTransaction.find()
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(Number(limit));
  return success(res, txs, "قائمة حركات الكسر");
}
