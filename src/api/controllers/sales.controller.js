import mongoose from "mongoose";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import ElectronicAccount from "../../models/ElectronicAccount.js";
import ElectronicTransaction from "../../models/ElectronicTransaction.js";
import { generateInvoiceNo } from "../../utils/generateInvoiceNo.js";
import { success, error } from "../../utils/responses.js";

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
    notes: Number(amount) >= 0 ? "إيداع من عملية بيع" : "سحب بسبب حذف فاتورة",
    recordedBy: userId
  }], { session });
}

export async function createSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
      branch, 
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
    const saleData = {
      invoiceNo,
      branch,
      items,
      customer,
      payment,
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
    const sale = await Sale.create([saleData], { session });

    // معالجة الدفع الإلكتروني (إذا لزم)
    if ((payment.method === "electronic" || payment.method === "electronic") && payment.electronicAccount) {
      await updateElectronicAccountBalance(
        payment.electronicAccount, 
        Number(sale[0].roundedTotal?.toString() || sale[0].total?.toString() || 0), 
        invoiceNo, 
        req.user._id, 
        session
      );
    }

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

    await session.commitTransaction();
    session.endSession();

    return success(res, sale[0], "تم إنشاء الفاتورة بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create sale error:', err);
    return error(res, "فشل إنشاء الفاتورة", 500, err.message);
  }
}

export async function createQuickSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
      branch, 
      items = [], 
      customer = {}, 
      paymentMethod = "cash", 
      electronicAccount,
      exchangedScrap = [],
      additionalServices = [],
      manualDiscount = 0 
    } = req.body;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "يجب إضافة منتجات على الأقل", 400);
    }

    // احسب subtotal لكل عنصر و مجموعات مثل createSale
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

    let scrapTotal = 0;
    for (const scrap of exchangedScrap) {
      const price = Number(scrap.pricePerGram || 0);
      const weight = Number(scrap.weight || 0);
      const raw = price * weight;
      const rounded = roundToNearest5(raw);
      scrap.total = rounded;
      scrapTotal += rounded;
    }

    const servicesTotal = (additionalServices || []).reduce((s, svc) => s + Number(svc.price || 0), 0);

    const totalBeforeRounding = itemsTotal + servicesTotal - scrapTotal - Number(manualDiscount || 0);
    const roundedTotal = roundToNearest5(totalBeforeRounding);

    const payment = {
      method: paymentMethod,
      amount: roundedTotal
    };
    if (electronicAccount) payment.electronicAccount = electronicAccount;

    const invoiceNo = generateInvoiceNo();
    const saleData = {
      invoiceNo,
      branch,
      items,
      customer,
      payment,
      exchangedScrap,
      additionalServices,
      manualDiscount,
      subtotal: itemsTotal,
      scrapTotal,
      servicesTotal,
      total: totalBeforeRounding,
      roundedTotal,
      createdBy: req.user._id
    };

    const sale = await Sale.create([saleData], { session });

    // معالجة الدفع الإلكتروني
    if (paymentMethod === "electronic" && electronicAccount) {
      await updateElectronicAccountBalance(
        electronicAccount, 
        Number(sale[0].roundedTotal?.toString() || sale[0].total?.toString() || 0), 
        invoiceNo, 
        req.user._id, 
        session
      );
    }

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
            notes: `بيع سريع - فاتورة ${invoiceNo}`
          }], { session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, sale[0], "تم إنشاء الفاتورة السريعة بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create quick sale error:', err);
    return error(res, "فشل إنشاء الفاتورة السريعة", 500, err.message);
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
      .skip((page-1)*limit)
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

    // إرجاع الرصيد الإلكتروني (إذا موجود)
    if (sale.payment && sale.payment.method === "electronic" && sale.payment.electronicAccount) {
      await updateElectronicAccountBalance(
        sale.payment.electronicAccount, 
        -Number(sale.roundedTotal?.toString() || sale.total?.toString() || 0), 
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
      installment: { count: 0, amount: 0 }
    };

    const statusStats = {
      draft: 0,
      pending: 0,
      paid: 0,
      cancelled: 0
    };

    sales.forEach(sale => {
      // إحصائيات الدفع
      const paymentMethod = sale.payment?.method || 'cash';
      const amount = Number(sale.total?.toString() || 0);
      
      paymentStats[paymentMethod].count += 1;
      paymentStats[paymentMethod].amount += amount;
      
      // إحصائيات الحالة
      statusStats[sale.status] += 1;
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



// أضف هذه الدالة في sales.controller.js
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
      .skip((page-1)*limit)
      .limit(Number(limit));

    // 🔥 التصحيح النهائي: تحويل البيانات لـ JSON صريح
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
    // لو الخطأ من فحص Joi أو من mongoose validation، قد يحتوي على تفاصيل
    return error(res, "فشل في تحديث الفاتورة", 500, err.message);
  }
}
