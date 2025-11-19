// src/api/controllers/scrap.controller.js
import mongoose from "mongoose";
import ScrapStore from "../../models/ScrapStore.js";
import ScrapTransaction from "../../models/ScrapTransaction.js";
import { ScrapService } from "../../services/scrap.service.js";
import { success, error } from "../../utils/responses.js";

// helper: add grams to scrap store for given karat
async function addToStore(session, branch, karat, grams) {
  const store = await ScrapStore.findOne({ branch }).session(session);
  if (!store) {
    const s = new ScrapStore({ branch, totals: [{ karat, grams }] });
    await s.save({ session });
    return s;
  }
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

// 1. شراء كسر من الزبون (في الأدوار)
export async function purchaseFromCustomer(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, pricePerGram, customerName, performedBy, notes } = req.body;
    
    // إضافة للكسر في الفرع
    await addToStore(session, branch, karat, grams);

    const totalValue = Number(pricePerGram) * Number(grams);
    const tx = await ScrapTransaction.create([{
      type: "purchase_from_customer",
      branchTo: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      pricePerGram: mongoose.Types.Decimal128.fromString(String(pricePerGram)),
      totalValue: mongoose.Types.Decimal128.fromString(String(totalValue)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      customerName,
      source: "customer",
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم شراء الكسر من الزبون", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في شراء الكسر", 400, err.message);
  }
}

// 2. إضافة كسر من الفاتورة (المحاسب)
export async function addFromInvoice(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, invoiceNumber, performedBy, notes } = req.body;
    
    await addToStore(session, branch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "add_from_invoice",
      branchTo: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      invoiceNumber,
      source: "invoice",
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم إضافة الكسر من الفاتورة", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إضافة الكسر", 400, err.message);
  }
}

// 3. إضافة كسر مباشر للمخزن (من مصدر خارجي)
export async function addToStoreDirect(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, source, performedBy, notes } = req.body;
    
    // إضافة مباشرة للمخزن
    await addToStore(session, branch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "direct_add",
      branchTo: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      source: source || "external",
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم إضافة الكسر مباشرة للمخزن", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إضافة الكسر للمخزن", 400, err.message);
  }
}

// 4. تحويل كسر من دور إلى المخزن
export async function transferToStore(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromBranch, toBranch, karat, grams, performedBy, notes } = req.body;
    
    // خصم من الفرع المصدر
    await subtractFromStore(session, fromBranch, karat, grams);
    // إضافة للمخزن الهدف
    await addToStore(session, toBranch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "transfer_to_store",
      branchFrom: fromBranch,
      branchTo: toBranch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      source: "branch_transfer",
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم تحويل الكسر للمخزن", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في تحويل الكسر", 400, err.message);
  }
}

// 5. خصم كسر من المخزن (للتجارة أو التصنيع)
export async function deductFromStore(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, karat, grams, destination, performedBy, notes } = req.body;
    
    await subtractFromStore(session, branch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "consume",
      branchFrom: branch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      destination,
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم خصم الكسر من المخزن", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في خصم الكسر", 400, err.message);
  }
}

// 6. تحويل كسر بين المخازن
export async function moveBetweenStores(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromBranch, toBranch, karat, grams, performedBy, notes } = req.body;
    
    await subtractFromStore(session, fromBranch, karat, grams);
    await addToStore(session, toBranch, karat, grams);

    const tx = await ScrapTransaction.create([{
      type: "move_between_stores",
      branchFrom: fromBranch,
      branchTo: toBranch,
      karat,
      grams: mongoose.Types.Decimal128.fromString(String(grams)),
      performedBy: performedBy || req.user?.name,
      recordedBy: req.user?._id,
      notes
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return success(res, tx[0], "تم نقل الكسر بين المخازن", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في نقل الكسر", 400, err.message);
  }
}

// 16. تحويل سكراب بين الفروع (مبسط)
export async function transferScrap(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromBranch, toBranch, karat, grams, notes } = req.body;
    
    await ScrapService.transferScrapBetweenBranches(
      session, 
      fromBranch, 
      toBranch, 
      karat, 
      grams, 
      req.user._id,
      notes
    );

    await session.commitTransaction();
    session.endSession();
    
    return success(res, null, `تم تحويل ${grams} جرام عيار ${karat} من ${fromBranch} إلى ${toBranch}`);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في تحويل السكراب", 400, err.message);
  }
}

// 17. تحويل كل سكراب فرع للمخزن (نهاية اليوم)
export async function transferAllToWarehouse(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromBranch } = req.body;
    
    const result = await ScrapService.transferAllScrapToWarehouse(
      session, 
      fromBranch, 
      "warehouse", 
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();
    
    return success(res, result, "تم تحويل كل السكراب للمخزن");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في تحويل السكراب", 400, err.message);
  }
}

// 7. قائمة أرصدة الكسر
export async function listStores(req, res) {
  try {
    const stores = await ScrapStore.find().sort({ branch: 1 });
    return success(res, stores, "قائمة أرصدة الكسر");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب أرصدة الكسر", 500, err.message);
  }
}

// 8. قائمة حركات الكسر
export async function listTransactions(req, res) {
  try {
    const { page = 1, limit = 50, branch, type } = req.query;
    
    let filter = {};
    if (branch) {
      filter.$or = [
        { branchFrom: branch },
        { branchTo: branch }
      ];
    }
    if (type) {
      filter.type = type;
    }
    
    const txs = await ScrapTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page-1)*limit)
      .limit(Number(limit));
    
    const total = await ScrapTransaction.countDocuments(filter);
    
    return success(res, {
      transactions: txs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "قائمة حركات الكسر");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب حركات الكسر", 500, err.message);
  }
}

// 9. تقرير إجمالي الكسر في المخزن
export async function getTotalScrapReport(req, res) {
  try {
    const stores = await ScrapStore.find().sort({ branch: 1 });
    
    const report = stores.map(store => {
      const totals = {};
      store.totals.forEach(item => {
        totals[item.karat] = Number(item.grams.toString());
      });
      
      return {
        branch: store.branch,
        totals,
        totalGrams: store.totals.reduce((sum, item) => sum + Number(item.grams.toString()), 0)
      };
    });

    return success(res, report, "تقرير إجمالي الكسر في المخزن");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// 10. تقرير حركات اليوم لكل دور
export async function getDailyBranchReport(req, res) {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const transactions = await ScrapTransaction.find({
      createdAt: { $gte: startDate, $lt: endDate },
      $or: [
        { type: "purchase_from_customer" },
        { type: "add_from_invoice" },
        { type: "transfer_to_store" }
      ]
    }).sort({ createdAt: -1 });

    const branchReport = {};
    transactions.forEach(tx => {
      const branch = tx.branchTo || tx.branchFrom;
      if (!branchReport[branch]) {
        branchReport[branch] = {
          branch,
          dailyTotal: { 18: 0, 21: 0, 24: 0 },
          transactions: []
        };
      }
      
      const grams = Number(tx.grams.toString());
      branchReport[branch].dailyTotal[tx.karat] += grams;
      branchReport[branch].transactions.push(tx);
    });

    return success(res, Object.values(branchReport), "تقرير حركات اليوم للأدوار");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// 11. تقرير الرصيد الحالي لكل دور
export async function getCurrentBranchBalances(req, res) {
  try {
    const stores = await ScrapStore.find().sort({ branch: 1 });
    const balances = stores.map(store => ({
      branch: store.branch,
      balances: store.totals.reduce((acc, item) => {
        acc[`karat_${item.karat}`] = Number(item.grams.toString());
        return acc;
      }, {})
    }));

    return success(res, balances, "الرصيد الحالي لكل دور");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب الأرصدة", 500, err.message);
  }
}

// 12. تقرير حركات المخزن التفصيلي
export async function getStoreDetailedReport(req, res) {
  try {
    const { branch, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    let filter = {};
    if (branch) {
      filter.$or = [
        { branchFrom: branch },
        { branchTo: branch }
      ];
    }
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await ScrapTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const stats = {
      totalAdded: { 18: 0, 21: 0, 24: 0 },
      totalDeducted: { 18: 0, 21: 0, 24: 0 },
      netChange: { 18: 0, 21: 0, 24: 0 }
    };

    transactions.forEach(tx => {
      const grams = Number(tx.grams.toString());
      if (tx.branchTo === branch) {
        stats.totalAdded[tx.karat] += grams;
        stats.netChange[tx.karat] += grams;
      } else if (tx.branchFrom === branch) {
        stats.totalDeducted[tx.karat] += grams;
        stats.netChange[tx.karat] -= grams;
      }
    });

    return success(res, {
      transactions,
      statistics: stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: await ScrapTransaction.countDocuments(filter)
      }
    }, "تقرير تفصيلي لحركات المخزن");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// 13. تقرير إجمالي الكسر حسب العيار
export async function getScrapSummaryByKarat(req, res) {
  try {
    const stores = await ScrapStore.find();
    
    const summary = { 18: 0, 21: 0, 24: 0 };
    
    stores.forEach(store => {
      store.totals.forEach(item => {
        summary[item.karat] += Number(item.grams.toString());
      });
    });

    return success(res, summary, "إجمالي الكسر حسب العيار");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// 14. تقرير إجمالي الكسر مع القيمة (لعمليات الشراء فقط)
export async function getScrapWithValueReport(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    let filter = { type: "purchase_from_customer" };
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await ScrapTransaction.find(filter)
      .sort({ createdAt: -1 });

    const report = {
      totalGrams: { 18: 0, 21: 0, 24: 0 },
      totalValue: { 18: 0, 21: 0, 24: 0 },
      averagePrice: { 18: 0, 21: 0, 24: 0 },
      transactions: transactions
    };

    transactions.forEach(tx => {
      const grams = Number(tx.grams.toString());
      const value = Number(tx.totalValue?.toString() || 0);
      
      report.totalGrams[tx.karat] += grams;
      report.totalValue[tx.karat] += value;
    });

    Object.keys(report.totalGrams).forEach(karat => {
      if (report.totalGrams[karat] > 0) {
        report.averagePrice[karat] = report.totalValue[karat] / report.totalGrams[karat];
      }
    });

    return success(res, report, "تقرير الكسر مع القيمة");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// 15. تقرير أداء الفروع (مقارنة بين الفروع)
export async function getBranchPerformanceReport(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const transactions = await ScrapTransaction.find(dateFilter);
    const currentStores = await ScrapStore.find();
    
    const branchPerformance = {};
    
    currentStores.forEach(store => {
      branchPerformance[store.branch] = {
        branch: store.branch,
        currentBalance: { 18: 0, 21: 0, 24: 0 },
        totalPurchased: { 18: 0, 21: 0, 24: 0 },
        totalTransferred: { 18: 0, 21: 0, 24: 0 },
        totalConsumed: { 18: 0, 21: 0, 24: 0 }
      };
      
      store.totals.forEach(item => {
        branchPerformance[store.branch].currentBalance[item.karat] = Number(item.grams.toString());
      });
    });

    transactions.forEach(tx => {
      const grams = Number(tx.grams.toString());
      const karat = tx.karat;
      
      switch(tx.type) {
        case "purchase_from_customer":
        case "add_from_invoice":
        case "direct_add":
          if (branchPerformance[tx.branchTo]) {
            branchPerformance[tx.branchTo].totalPurchased[karat] += grams;
          }
          break;
          
        case "transfer_to_store":
          if (branchPerformance[tx.branchFrom]) {
            branchPerformance[tx.branchFrom].totalTransferred[karat] += grams;
          }
          break;
          
        case "consume":
          if (branchPerformance[tx.branchFrom]) {
            branchPerformance[tx.branchFrom].totalConsumed[karat] += grams;
          }
          break;
      }
    });

    return success(res, Object.values(branchPerformance), "تقرير أداء الفروع");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}