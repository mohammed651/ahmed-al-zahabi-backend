import mongoose from "mongoose";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import ElectronicAccount from "../../models/ElectronicAccount.js";
import ElectronicTransaction from "../../models/ElectronicTransaction.js";
import { generateInvoiceNo } from "../../utils/generateInvoiceNo.js";
import { success, error } from "../../utils/responses.js";

// دالة التقريب لأقرب 5 جنيه
const roundToNearest5 = (price) => {
  return Math.ceil(price / 5) * 5; // غيرنا لـ ceil بدل round
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
      return error(res, "يجب إضافة منتجات على الأقل", 400);
    }

    // التحقق من المخزون أولاً
    for (const it of items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (!prod) {
          await session.abortTransaction();
          return error(res, `المنتج غير موجود: ${it.productName}`, 404);
        }
        
        if (prod.count_in_showcase < (it.quantity || 1)) {
          await session.abortTransaction();
          return error(res, `غير متوفر في المخزون: ${prod.name} - المطلوب: ${it.quantity || 1} - المتاح: ${prod.count_in_showcase}`, 400);
        }
      }
    }

    // حساب subtotal لكل منتج
    for (const it of items) {
      const price = Number(it.pricePerGram || 0);
      const weight = Number(it.weight || 0);
      const making = Number(it.makingCost || 0);
      const quantity = Number(it.quantity || 1);
      
      it.subtotal = (price + making) * weight * quantity;
    }

    // حساب total لكل scrap item
    for (const scrap of exchangedScrap) {
      const price = Number(scrap.pricePerGram || 0);
      const weight = Number(scrap.weight || 0);
      scrap.total = price * weight;
    }

    const invoiceNo = generateInvoiceNo();
    
    // إنشاء الفاتورة - الحسابات هتتعمل تلقائياً في الـ middleware
    const sale = await Sale.create([{
      invoiceNo, 
      branch, 
      items, 
      customer,
      payment,
      exchangedScrap,
      additionalServices,
      manualDiscount,
      notes,
      createdBy: req.user._id
    }], { session });

    // معالجة الدفع الإلكتروني
    if (payment.method === "electronic" && payment.electronicAccount) {
      await updateElectronicAccountBalance(
        payment.electronicAccount, 
        Number(sale[0].total?.toString() || 0), 
        invoiceNo, 
        req.user._id, 
        session
      );
    }

    // خصم المخزون
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
            to: "sale",
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
      return error(res, "يجب إضافة منتجات على الأقل", 400);
    }

    // استخدام نفس منطق createSale مع تبسيط
    const payment = {
      method: paymentMethod,
      amount: 0 // هيتم حسابه تلقائياً
    };

    if (electronicAccount) {
      payment.electronicAccount = electronicAccount;
    }

    const saleData = {
      branch, 
      items, 
      customer,
      payment,
      exchangedScrap,
      additionalServices,
      manualDiscount,
      createdBy: req.user._id
    };

    const invoiceNo = generateInvoiceNo();
    const sale = await Sale.create([{ ...saleData, invoiceNo }], { session });

    // معالجة الدفع الإلكتروني
    if (paymentMethod === "electronic" && electronicAccount) {
      await updateElectronicAccountBalance(
        electronicAccount, 
        Number(sale[0].total?.toString() || 0), 
        invoiceNo, 
        req.user._id, 
        session
      );
    }

    // خصم المخزون
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
            to: "sale",
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
      return error(res, "الفاتورة غير موجودة", 404);
    }

    // إرجاع المخزون
    for (const it of sale.items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (prod) {
          prod.count_in_showcase = (prod.count_in_showcase || 0) + (it.quantity || 1);
          await prod.save({ session });
          
          await StockMovement.create([{
            product: prod._id,
            type: "in",
            from: "sale",
            to: "showcase",
            quantity: it.quantity || 1,
            performedByEmployeeName: req.user.name,
            recordedBy: req.user._id,
            notes: `إرجاع بسبب حذف فاتورة ${sale.invoiceNo}`
          }], { session });
        }
      }
    }

    // إرجاع الرصيد الإلكتروني
    if (sale.payment.method === "electronic" && sale.payment.electronicAccount) {
      await updateElectronicAccountBalance(
        sale.payment.electronicAccount, 
        -Number(sale.total?.toString() || 0), 
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
    const { branch, scrapDetails, customer, payment } = req.body;
    
    if (!scrapDetails || scrapDetails.length === 0) {
      return error(res, "بيانات الكسر مطلوبة", 400);
    }

    const invoiceNo = generateInvoiceNo();
    
    // إنشاء فاتورة للكسر فقط
    const sale = await Sale.create([{
      invoiceNo,
      branch,
      items: [], // لا توجد منتجات، فقط كسر
      customer,
      payment,
      exchangedScrap: scrapDetails,
      createdBy: req.user._id,
      notes: "فاتورة شراء كسر"
    }], { session });

    // معالجة الدفع (خصم المبلغ)
    if (payment.method === "electronic" && payment.electronicAccount) {
      await updateElectronicAccountBalance(
        payment.electronicAccount, 
        -Number(sale[0].total?.toString() || 0), 
        invoiceNo, 
        req.user._id, 
        session
      );
    }

    // هنا سيتم إضافة الكسر لنظام الكسر (محتاجين نربط مع scrap system)

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