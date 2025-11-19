// src/api/controllers/sales.controller.js
import mongoose from "mongoose";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import ElectronicAccount from "../../models/ElectronicAccount.js";
import ElectronicTransaction from "../../models/ElectronicTransaction.js";
import { generateInvoiceNo } from "../../utils/generateInvoiceNo.js";
import { success, error } from "../../utils/responses.js";
import { recordCashMovement } from "../../services/cash.service.js"; // service مركزي لحركات الكاش
import { ScrapService } from "../../services/scrap.service.js"; // خدمة السكراب

// دالة التقريب لأقرب 5 جنيه — مطابق للفرونت (Math.round)
const roundToNearest5 = (price) => {
  const n = Number(price || 0);
  return Math.round(n / 5) * 5;
};

// دالة مساعدة لتحديث رصيد الحساب الإلكتروني
async function updateElectronicAccountBalance(accountId, amount, reference, userId, session) {
  const account = await ElectronicAccount.findById(accountId).session(session);
  if (!account) throw new Error("الحساب الإلكتروني غير موجود");

  const currentBalance = Number(account.currentBalance?.toString() || 0);
  account.currentBalance = currentBalance + Number(amount);
  await account.save({ session });

  await ElectronicTransaction.create([{
    account: accountId,
    type: Number(amount) >= 0 ? "deposit" : "withdrawal",
    amount: Math.abs(Number(amount)),
    reference: `بيع - ${reference}`,
    notes: Number(amount) >= 0 ? "إيداع من عملية بيع" : "سحب بسبب حذف فاتورة/تسوية",
    recordedBy: userId
  }], { session });
}

/**
 * createSale
 * يدعم الآن:
 * - أخذ الفرع من req.user.branch
 * - دفع مختلط: payment.cashAmount, payment.electronicAmount (+ payment.electronicAccount)
 * - تسجيل حركة نقدية للخزنة عن طريق recordCashMovement
 * - تعديل حالة الفاتورة إلى pending/paid حسب المدفوع
 * - إضافة السكراب تلقائياً لمخزن الفرع
 */
export async function createSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // branch يجب أن يأتي من اليوزر (كما طلبت)
    const branchFromUser = req.user?.branch;
    if (!branchFromUser) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "الفرع الخاص بالمستخدم غير مُعرّف", 400);
    }

    const {
      items = [],
      customer = {},
      payment = {},
      exchangedScrap = [],
      additionalServices = [],
      manualDiscount = 0,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "يجب إضافة منتجات على الأقل", 400);
    }

    // التحقق من المخزون أولاً
    for (const it of items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (!prod) {
          await session.abortTransaction();
          session.endSession();
          return error(res, `المنتج غير موجود: ${it.productName}`, 404);
        }

        if (prod.count_in_showcase < (it.quantity || 1)) {
          await session.abortTransaction();
          session.endSession();
          return error(res, `غير متوفر في المخزون: ${prod.name} - المطلوب: ${it.quantity || 1} - المتاح: ${prod.count_in_showcase}`, 400);
        }
      }
    }

    // حساب subtotal لكل منتج (وبالتقريب كما في الفرونت)
    let itemsTotal = 0;
    for (const it of items) {
      const price = Number(it.pricePerGram || it.price || 0);
      const weight = Number(it.weight || 0);
      const making = Number(it.makingCost || 0);
      const quantity = Number(it.quantity || it.qty || 1);

      const rawSubtotal = (price + making) * weight * quantity;
      const roundedSubtotal = roundToNearest5(rawSubtotal);
      it.subtotal = roundedSubtotal;
      itemsTotal += roundedSubtotal;
    }

    // حساب total لكل scrap item (ومجموع السكراب)
    let scrapTotal = 0;
    for (const scrap of exchangedScrap) {
      const price = Number(scrap.pricePerGram || 0);
      const weight = Number(scrap.weight || 0);
      const raw = price * weight;
      const rounded = roundToNearest5(raw);
      scrap.total = rounded;
      scrapTotal += rounded;
    }

    // حساب مجموع الخدمات
    const servicesTotal = (additionalServices || []).reduce((s, svc) => s + Number(svc.price || 0), 0);

    // حساب المجموع النهائي قبل التقريب (تطبيق الخصم على الـ total من المنتجات + خدمات - سكراب)
    const totalBeforeRounding = itemsTotal + servicesTotal - scrapTotal - Number(manualDiscount || 0);
    const roundedTotal = roundToNearest5(totalBeforeRounding);

    const invoiceNo = generateInvoiceNo();

    // جهز بيانات الفاتورة مع القيم المحسوبة
    // لاحظ: نعطي sale.payment كما استلمناها، لكن نضيف حقول مساعدة لاحقاً
    const saleData = {
      invoiceNo,
      branch: branchFromUser,
      items,
      customer,
      payment: payment || { method: "cash", amount: roundedTotal },
      exchangedScrap,
      additionalServices,
      manualDiscount,
      subtotal: itemsTotal,
      scrapTotal,
      servicesTotal,
      total: totalBeforeRounding,
      roundedTotal,
      notes,
      createdBy: req.user._id
    };

    // إنشاء الفاتورة داخل الـ session
    const saleArr = await Sale.create([saleData], { session });
    const sale = saleArr[0];

    // === معالجة المدفوعات (نُدعم الدفع المختلط) ===
    // توقعات payment possible shapes:
    // 1) legacy: { method: "cash" | "electronic" | "installment", amount }
    // 2) mixed: { cashAmount: 1000, electronicAmount: 500, electronicAccount }
    // 3) quick sale used paymentMethod field (handled elsewhere)
    const cashAmount = Number(payment?.cashAmount || (payment?.method === "cash" ? (payment?.amount || roundedTotal) : 0));
    const electronicAmount = Number(payment?.electronicAmount || (payment?.method === "electronic" ? (payment?.amount || 0) : 0));
    const electronicAccountId = payment?.electronicAccount || payment?.electronicAccountId || null;

    // سجل الكاش في الخزنة لو فيه مبلغ نقدي
    if (cashAmount && cashAmount > 0) {
      await recordCashMovement({
        session,
        branch: branchFromUser,
        type: "deposit",
        amount: Number(cashAmount),
        reason: `نقدي - فاتورة ${invoiceNo}`,
        user: req.user._id,
        referenceType: "sale",
        referenceId: sale._id
      });
    }

    // حدث الحساب الإلكتروني لو فيه مبلغ إلكتروني
    if (electronicAmount && electronicAmount > 0) {
      if (!electronicAccountId) {
        // rollback because electronic amount provided without account
        await session.abortTransaction();
        session.endSession();
        return error(res, "المبلغ الإلكتروني معطى بدون حساب إلكتروني", 400);
      }
      await updateElectronicAccountBalance(
        electronicAccountId,
        Number(electronicAmount),
        invoiceNo,
        req.user._id,
        session
      );
    }

    // حدّد الحالة: paid إذا المدفوع >= roundedTotal، وإلا pending
    const totalPaid = Number(cashAmount || 0) + Number(electronicAmount || 0);
    if (totalPaid >= Number(roundedTotal)) {
      sale.status = "paid";
    } else if (totalPaid > 0 && totalPaid < Number(roundedTotal)) {
      sale.status = "pending";
    } else {
      // ما فيش دفع — خليها draft عادي أو حسب ما جاء
      sale.status = sale.status || "draft";
    }

    // نحدّث حقل payment ليوضح الأرقام المسيطرة (مفيد للفرونت)
    sale.payment = {
      method: payment?.method || (totalPaid > 0 ? "mixed" : "cash"),
      amount: mongoose.Types.Decimal128.fromString(String(roundedTotal)),
      cashAmount: mongoose.Types.Decimal128.fromString(String(cashAmount || 0)),
      electronicAmount: mongoose.Types.Decimal128.fromString(String(electronicAmount || 0)),
      electronicAccount: electronicAccountId || undefined,
      installmentDetails: payment?.installmentDetails || undefined
    };

    await sale.save({ session });

    // خصم المخزون وإنشاء StockMovement (from: showcase -> to: store)
    for (const it of items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (prod) {
          prod.count_in_showcase = prod.count_in_showcase - (it.quantity || 1);
          await prod.save({ session });

          await StockMovement.create([{
            product: prod._id,
            type: "out",
            from: "showcase",
            to: "store",
            quantity: it.quantity || 1,
            performedByEmployeeName: req.user.name,
            recordedBy: req.user._id,
            notes: `بيع - فاتورة ${invoiceNo}`
          }], { session });
        }
      }
    }

    // === إضافة السكراب تلقائياً لمخزن الفرع ===
    if (exchangedScrap && exchangedScrap.length > 0) {
      await ScrapService.addScrapFromSale(session, sale, req.user._id);
    }

    await session.commitTransaction();
    session.endSession();

    // رجّع الفاتورة بعد populate مفيد
    await sale.populate("createdBy", "name");
    await sale.populate("payment.electronicAccount", "name");

    return success(res, sale, "تم إنشاء الفاتورة بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create sale error:', err);
    return error(res, "فشل إنشاء الفاتورة", 500, err.message);
  }
}

export async function createQuickSale(req, res) {
  // إعادة توجيه إلى createSale بعد تجهيز payment على شكل مبسط (للتوافق)
  try {
    // ضع payment كما يرسله الفرونت في quick sale إلى body.payment
    const {
      paymentMethod = "cash",
      electronicAccount,
      cashAmount,
      electronicAmount
    } = req.body;

    // إذا المستخدم أرسل مبالغ جزئية ضمن quick (cashAmount/electronicAmount)، حولهم
    req.body.payment = req.body.payment || {};
    if (cashAmount !== undefined || electronicAmount !== undefined) {
      req.body.payment.cashAmount = Number(cashAmount || 0);
      req.body.payment.electronicAmount = Number(electronicAmount || 0);
      if (electronicAccount) req.body.payment.electronicAccount = electronicAccount;
      // method فارغ أو mixed
      req.body.payment.method = (Number(req.body.payment.cashAmount || 0) > 0 && Number(req.body.payment.electronicAmount || 0) > 0) ? "mixed" : paymentMethod;
    } else {
      // legacy: single method
      req.body.payment = { method: paymentMethod, amount: undefined, electronicAccount };
    }

    // قم باستدعاء createSale لعمل الباقي
    return await createSale(req, res);
  } catch (err) {
    console.error('createQuickSale wrapper error:', err);
    return error(res, "فشل في إنشاء الفاتورة السريعة", 500, err.message);
  }
}

export async function listSales(req, res) {
  try {
    const { page = 1, limit = 50, status, branch } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (branch) filter.branch = branch;

    const sales = await Sale.find(filter)
      .populate("createdBy", "name")
      .populate("payment.electronicAccount", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Sale.countDocuments(filter);

    return success(res, {
      sales,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "قائمة الفواتير");
  } catch (err) {
    console.error('List sales error:', err);
    return error(res, "فشل في جلب الفواتير", 500, err.message);
  }
}

export async function getSale(req, res) {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("payment.electronicAccount", "name");

    if (!sale) return error(res, "الفاتورة غير موجودة", 404);
    return success(res, sale, "الفاتورة");
  } catch (err) {
    console.error('Get sale error:', err);
    return error(res, "فشل في جلب الفاتورة", 500, err.message);
  }
}

export async function getSaleByInvoiceNo(req, res) {
  try {
    const { invoiceNo } = req.params;
    const sale = await Sale.findOne({ invoiceNo })
      .populate("createdBy", "name")
      .populate("payment.electronicAccount", "name");

    if (!sale) return error(res, "الفاتورة غير موجودة", 404);
    return success(res, sale, "الفاتورة");
  } catch (err) {
    console.error('Get sale by invoice error:', err);
    return error(res, "فشل في جلب الفاتورة", 500, err.message);
  }
}

export async function updateSaleStatus(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { status } = req.body;

    const sale = await Sale.findById(id).session(session);
    if (!sale) {
      await session.abortTransaction();
      return error(res, "الفاتورة غير موجودة", 404);
    }

    sale.status = status;
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    return success(res, sale, "تم تحديث حالة الفاتورة بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update sale status error:', err);
    return error(res, "فشل في تحديث حالة الفاتورة", 500, err.message);
  }
}

export async function deleteSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id).session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "الفاتورة غير موجودة", 404);
    }

    // إرجاع المخزون (من store -> showcase)
    for (const it of sale.items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (prod) {
          prod.count_in_showcase = (prod.count_in_showcase || 0) + (it.quantity || 1);
          await prod.save({ session });

          await StockMovement.create([{
            product: prod._id,
            type: "in",
            from: "store",
            to: "showcase",
            quantity: it.quantity || 1,
            performedByEmployeeName: req.user.name,
            recordedBy: req.user._id,
            notes: `إرجاع بسبب حذف فاتورة ${sale.invoiceNo}`
          }], { session });
        }
      }
    }

    // === إزالة السكراب من المخزن عند حذف الفاتورة ===
    if (sale.exchangedScrap && sale.exchangedScrap.length > 0) {
      await ScrapService.removeScrapFromSale(session, sale, req.user._id);
    }

    // عكس المدفوعات:
    // لو كان فيه دفع إلكتروني مسجّل (electronicAmount أو payment.method === "electronic")
    const payment = sale.payment || {};
    const cashAmount = Number(payment?.cashAmount?.toString?.() || payment?.cashAmount || 0) || 0;
    const electronicAmount = Number(payment?.electronicAmount?.toString?.() || payment?.electronicAmount || 0) || 0;
    const electronicAccountId = payment?.electronicAccount || null;

    // لو فيه نقدي — نسجل مصروف بنفس القيمة (عكس الإيداع الذي سجلناه عند الإنشاء)
    if (cashAmount > 0) {
      await recordCashMovement({
        session,
        branch: sale.branch,
        type: "expense",
        amount: Number(cashAmount),
        reason: `عكس نقدي - حذف فاتورة ${sale.invoiceNo}`,
        user: req.user._id,
        referenceType: "sale_deletion",
        referenceId: sale._id
      });
    }

    // لو فيه إلكتروني — نخصم من الحساب الإلكتروني
    if (electronicAmount > 0 && electronicAccountId) {
      await updateElectronicAccountBalance(
        electronicAccountId,
        -Number(electronicAmount),
        `حذف-${sale.invoiceNo}`,
        req.user._id,
        session
      );
    }

    await Sale.findByIdAndDelete(id).session(session);
    await session.commitTransaction();
    session.endSession();

    return success(res, null, "تم حذف الفاتورة بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Delete sale error:', err);
    return error(res, "فشل في حذف الفاتورة", 500, err.message);
  }
}

export async function getSalesReport(req, res) {
  try {
    const { startDate, endDate, branch, paymentMethod, status } = req.query;

    let filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (branch) filter.branch = branch;
    if (paymentMethod) filter["payment.method"] = paymentMethod;
    if (status) filter.status = status;

    const sales = await Sale.find(filter)
      .populate("createdBy", "name")
      .populate("payment.electronicAccount", "name")
      .sort({ createdAt: -1 });

    // إحصائيات التقرير
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total?.toString() || 0), 0);
    const roundedRevenue = sales.reduce((sum, sale) => sum + Number(sale.roundedTotal?.toString() || 0), 0);

    const paymentStats = {
      cash: { count: 0, amount: 0 },
      electronic: { count: 0, amount: 0 },
      installment: { count: 0, amount: 0 },
      mixed: { count: 0, amount: 0 }
    };

    const statusStats = {
      draft: 0,
      pending: 0,
      paid: 0,
      cancelled: 0
    };

    sales.forEach(sale => {
      // إحصائيات الدفع
      const pm = sale.payment?.method || 'cash';
      const cashAmt = Number(sale.payment?.cashAmount?.toString?.() || sale.payment?.cashAmount || 0) || (pm === 'cash' ? Number(sale.roundedTotal?.toString?.() || 0) : 0);
      const elecAmt = Number(sale.payment?.electronicAmount?.toString?.() || sale.payment?.electronicAmount || 0) || (pm === 'electronic' ? Number(sale.roundedTotal?.toString?.() || 0) : 0);
      const amount = cashAmt + elecAmt;

      if (!paymentStats[pm]) paymentStats[pm] = { count: 0, amount: 0 };
      paymentStats[pm].count += 1;
      paymentStats[pm].amount += amount;

      // إحصائيات الحالة
      statusStats[sale.status] = (statusStats[sale.status] || 0) + 1;
    });

    const report = {
      totalSales,
      totalRevenue,
      roundedRevenue,
      paymentStats,
      statusStats,
      sales,
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'النهاية'
      }
    };

    return success(res, report, "تقرير المبيعات");
  } catch (err) {
    console.error('Sales report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

/**
 * purchaseScrap - شراء كسر (كما كان)
 */
export async function purchaseScrap(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, scrapDetails, customer = {}, payment: incomingPayment } = req.body;

    if (!scrapDetails || scrapDetails.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "بيانات الكسر مطلوبة", 400);
    }

    // دالة تقريب لأقرب 5 مطابق للفرونت
    const roundToNearest5Local = (n) => {
      const num = Number(n || 0);
      if (!isFinite(num)) return 0;
      return Math.round(num / 5) * 5;
    };

    // حساب total لكل scrap item و تجميع scrapTotal (موجب)
    let scrapTotal = 0;
    const mappedScrap = scrapDetails.map(scrap => {
      const price = Number(scrap.pricePerGram || 0);
      const weight = Number(scrap.weight || 0);
      const raw = price * weight;
      const rounded = roundToNearest5Local(raw);
      scrapTotal += rounded;

      return {
        name: scrap.name,
        karat: scrap.karat,
        weight,
        pricePerGram: price,
        total: rounded
      };
    });

    const itemsTotal = 0;
    const servicesTotal = 0;
    const manualDiscount = Number(req.body.manualDiscount || 0);

    // صافي القيمة (قد يكون سالبًا إذا المتجر يدفع للعميل)
    const net = itemsTotal + servicesTotal - scrapTotal - manualDiscount;

    // قيمة الدفع التي يجب أن تُعرض وتُخزن في payment.amount (دائماً موجبة)
    const payAmount = Math.abs(net);
    const roundedPayAmount = roundToNearest5Local(payAmount);

    // جهّز payment: لو أرسله العميل خليه، وإلا أنشئ واحد افتراضي نقدي بالمبلغ الإيجابي
    const payment = (incomingPayment && typeof incomingPayment === 'object')
      ? { ...incomingPayment, amount: roundedPayAmount }
      : { method: 'cash', amount: roundedPayAmount };

    const invoiceNo = generateInvoiceNo();

    // أنشئ بيانات الفاتورة: نحتفظ بـ total = net (قد يكون سالباً) لكن roundedTotal ومقدار الدفع موجبان
    const saleData = {
      invoiceNo,
      branch,
      items: [], // لا منتجات
      customer,
      payment,
      exchangedScrap: mappedScrap,
      subtotal: itemsTotal,
      scrapTotal,
      servicesTotal,
      total: net,                // صريح (قد يكون سالب)
      roundedTotal: roundedPayAmount, // موجبة: مقدار الدفع
      createdBy: req.user._id,
      notes: "فاتورة شراء كسر",
      manualDiscount
    };

    const sale = await Sale.create([saleData], { session });

    // === إضافة السكراب للمخزن في عملية الشراء المباشر ===
    if (scrapDetails && scrapDetails.length > 0) {
      await ScrapService.addScrapFromSale(session, sale, req.user._id);
    }

    // معالجة الدفع الإلكتروني:
    // لو الدفع إلكتروني، المتجر يدفع للعميل -> نمرّر قيمة سالبة لسحب من الحساب الإلكتروني
    if (payment.method === "electronic" && payment.electronicAccount) {
      await updateElectronicAccountBalance(
        payment.electronicAccount,
        -Number(roundedPayAmount), // سحب (سالب) لأن المتجر يدفع
        invoiceNo,
        req.user._id,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, sale[0], "تم شراء الكسر بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Purchase scrap error:', err);
    return error(res, "فشل في شراء الكسر", 500, err.message);
  }
}

/**
 * getMySales - فواتيري الشخصية (paginated)
 */
export async function getMySales(req, res) {
  try {
    const { page = 1, limit = 50, status, startDate, endDate } = req.query;

    let filter = { createdBy: req.user._id };

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    let sales = await Sale.find(filter)
      .populate("createdBy", "name")
      .populate("payment.electronicAccount", "name")
      .sort({ createdAt: -1 })
      .lean()
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // تحويل البيانات لـ JSON صريح للـ front
    sales = sales.map(sale => ({
      ...sale,
      _id: sale._id?.toString(),
      createdBy: sale.createdBy ? {
        _id: sale.createdBy._id?.toString(),
        name: sale.createdBy.name
      } : null,
      createdAt: sale.createdAt?.toISOString(),
      updatedAt: sale.updatedAt?.toISOString(),
      items: sale.items?.map(item => ({
        ...item,
        _id: item._id?.toString()
      }))
    }));

    const total = await Sale.countDocuments(filter);

    return success(res, {
      sales,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "فواتيري الشخصية");
  } catch (err) {
    console.error('Get my sales error:', err);
    return error(res, "فشل في جلب الفواتير", 500, err.message);
  }
}

/**
 * updateSale - تحديث الحقول المسموح بها
 */
export async function updateSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const updateData = req.body;

    const sale = await Sale.findById(id).session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "الفاتورة غير موجودة", 404);
    }

    // الحقول المسموح بتحديثها (نادمج فقط هذه الحقول)
    const allowed = [
      'branch',
      'customer',
      'notes',
      'manualDiscount',
      'exchangedScrap',
      'additionalServices',
      'items',
      'payment',
      'status'
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updateData, key)) {
        sale[key] = updateData[key];
      }
    }

    // دعم بديل: إذا أرسل العميل paymentMethod بدلاً من payment object
    if (updateData.paymentMethod && !updateData.payment) {
      sale.payment = {
        method: updateData.paymentMethod,
        // amount سيضبطه pre("save") إلى roundedTotal لكن نعطي قيمة مؤقتة إذا وُجدت
        amount: sale.payment?.amount || mongoose.Types.Decimal128.fromString("0")
      };
    }

    // احفظ — وسيعمل pre("save") في الموديل لإعادة حساب subtotal/total/roundedTotal وملء payment.amount
    await sale.save({ session });

    // بعد الحفظ نعمل populate للحقول المفيدة للرد
    await sale.populate("createdBy", "name");
    await sale.populate("payment.electronicAccount", "name");

    await session.commitTransaction();
    session.endSession();

    return success(res, sale, "تم تحديث الفاتورة بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update sale error:', err);
    return error(res, "فشل في تحديث الفاتورة", 500, err.message);
  }
}