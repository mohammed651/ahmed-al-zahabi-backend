// src/api/controllers/returns.controller.js
import mongoose from "mongoose";
import Return from "../../models/Return.js";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import ElectronicAccount from "../../models/ElectronicAccount.js";
import ElectronicTransaction from "../../models/ElectronicTransaction.js";
import { generateReturnNumber } from "../../utils/generateReturnNumber.js";
import { success, error } from "../../utils/responses.js";

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
    reference: `مرتجع - ${reference}`,
    notes: Number(amount) >= 0 ? "إيداع من عملية مرتجع" : "سحب بسبب مرتجع",
    recordedBy: userId
  }], { session });
}

// إنشاء طلب إرجاع
export async function createReturn(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
      originalSaleId,
      type,
      returnedItems,
      exchangeItems = [],
      refund = {},
      reason,
      notes,
      branch
    } = req.body;

    // التحقق من وجود الفاتورة الأصلية
    const originalSale = await Sale.findById(originalSaleId).session(session);
    if (!originalSale) {
      await session.abortTransaction();
      return error(res, "الفاتورة الأصلية غير موجودة", 404);
    }

    // التحقق من العناصر المرتجعة
    if (!returnedItems || returnedItems.length === 0) {
      await session.abortTransaction();
      return error(res, "يجب إضافة عناصر مرتجعة على الأقل", 400);
    }

    // التحقق من أن العناصر المرتجعة موجودة في الفاتورة الأصلية
    for (const returnedItem of returnedItems) {
      const originalItem = originalSale.items.id(returnedItem.originalItem);
      if (!originalItem) {
        await session.abortTransaction();
        return error(res, `العنصر المراد إرجاعه غير موجود في الفاتورة الأصلية`, 400);
      }
    }

    const returnNumber = generateReturnNumber();
    
    // إنشاء طلب الإرجاع
    const returnRequest = await Return.create([{
      returnNumber,
      originalSale: originalSaleId,
      originalInvoiceNo: originalSale.invoiceNo,
      type,
      returnedItems,
      exchangeItems,
      refund,
      reason,
      notes,
      branch,
      requestedBy: req.user._id
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return success(res, returnRequest[0], "تم إنشاء طلب الإرجاع بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create return error:', err);
    return error(res, "فشل في إنشاء طلب الإرجاع", 500, err.message);
  }
}

// الموافقة على طلب الإرجاع ومعالجته
export async function approveReturn(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    
    const returnRequest = await Return.findById(id).session(session);
    if (!returnRequest) {
      await session.abortTransaction();
      return error(res, "طلب الإرجاع غير موجود", 404);
    }

    if (returnRequest.status !== "pending") {
      await session.abortTransaction();
      return error(res, "لا يمكن معالجة طلب الإرجاع هذا", 400);
    }

    // تحديث حالة طلب الإرجاع
    returnRequest.status = "approved";
    returnRequest.approvedBy = req.user._id;
    await returnRequest.save({ session });

    // معالجة الإرجاع حسب النوع
    if (returnRequest.type === "full_return" || returnRequest.type === "partial_return") {
      // إرجاع المخزون
      for (const item of returnRequest.returnedItems) {
        if (item.product) {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            product.count_in_showcase = (product.count_in_showcase || 0) + (item.quantity || 1);
            await product.save({ session });
            
            await StockMovement.create([{
              product: product._id,
              type: "in",
              from: "return",
              to: "showcase",
              quantity: item.quantity || 1,
              performedByEmployeeName: req.user.name,
              recordedBy: req.user._id,
              notes: `إرجاع - ${returnRequest.returnNumber}`
            }], { session });
          }
        }
      }

      // معالجة الاسترجاع المالي
      if (returnRequest.refund && returnRequest.refund.method === "electronic" && returnRequest.refund.electronicAccount) {
        await updateElectronicAccountBalance(
          returnRequest.refund.electronicAccount,
          Number(returnRequest.netRefundAmount?.toString() || 0),
          returnRequest.returnNumber,
          req.user._id,
          session
        );
      }
    }

    // في حالة الاستبدال
    if (returnRequest.type === "exchange") {
      // إرجاع العناصر القديمة
      for (const item of returnRequest.returnedItems) {
        if (item.product) {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            product.count_in_showcase = (product.count_in_showcase || 0) + (item.quantity || 1);
            await product.save({ session });
            
            await StockMovement.create([{
              product: product._id,
              type: "in",
              from: "return",
              to: "showcase",
              quantity: item.quantity || 1,
              performedByEmployeeName: req.user.name,
              recordedBy: req.user._id,
              notes: `إرجاع استبدال - ${returnRequest.returnNumber}`
            }], { session });
          }
        }
      }

      // خصم العناصر البديلة
      for (const item of returnRequest.exchangeItems) {
        if (item.product) {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            if (product.count_in_showcase < (item.quantity || 1)) {
              await session.abortTransaction();
              return error(res, `غير متوفر في المخزون: ${product.name}`, 400);
            }
            
            product.count_in_showcase = product.count_in_showcase - (item.quantity || 1);
            await product.save({ session });
            
            await StockMovement.create([{
              product: product._id,
              type: "out",
              from: "showcase",
              to: "exchange",
              quantity: item.quantity || 1,
              performedByEmployeeName: req.user.name,
              recordedBy: req.user._id,
              notes: `استبدال - ${returnRequest.returnNumber}`
            }], { session });
          }
        }
      }

      // معالجة الفرق المالي في الاستبدال
      if (returnRequest.netRefundAmount > 0 && returnRequest.refund && returnRequest.refund.method === "electronic" && returnRequest.refund.electronicAccount) {
        await updateElectronicAccountBalance(
          returnRequest.refund.electronicAccount,
          Number(returnRequest.netRefundAmount?.toString() || 0),
          returnRequest.returnNumber,
          req.user._id,
          session
        );
      }
    }

    returnRequest.status = "completed";
    returnRequest.processedBy = req.user._id;
    await returnRequest.save({ session });

    await session.commitTransaction();
    session.endSession();

    return success(res, returnRequest, "تم معالجة طلب الإرجاع بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Approve return error:', err);
    return error(res, "فشل في معالجة طلب الإرجاع", 500, err.message);
  }
}

// رفض طلب الإرجاع
export async function rejectReturn(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const returnRequest = await Return.findById(id).session(session);
    if (!returnRequest) {
      await session.abortTransaction();
      return error(res, "طلب الإرجاع غير موجود", 404);
    }

    if (returnRequest.status !== "pending") {
      await session.abortTransaction();
      return error(res, "لا يمكن رفض طلب الإرجاع هذا", 400);
    }

    returnRequest.status = "rejected";
    returnRequest.notes = rejectionReason ? `مرفوض - ${rejectionReason}` : "مرفوض";
    returnRequest.approvedBy = req.user._id;
    
    await returnRequest.save({ session });
    await session.commitTransaction();
    session.endSession();

    return success(res, returnRequest, "تم رفض طلب الإرجاع");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Reject return error:', err);
    return error(res, "فشل في رفض طلب الإرجاع", 500, err.message);
  }
}

// قائمة طلبات الإرجاع
export async function listReturns(req, res) {
  try {
    const { page = 1, limit = 50, status, branch } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (branch) filter.branch = branch;
    
    const returns = await Return.find(filter)
      .populate("originalSale", "invoiceNo total customer")
      .populate("requestedBy", "name")
      .populate("approvedBy", "name")
      .populate("processedBy", "name")
      .populate("refund.electronicAccount", "name")
      .sort({ createdAt: -1 })
      .skip((page-1)*limit)
      .limit(Number(limit));

    const total = await Return.countDocuments(filter);

    return success(res, {
      returns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "قائمة طلبات الإرجاع");
  } catch (err) {
    console.error('List returns error:', err);
    return error(res, "فشل في جلب طلبات الإرجاع", 500, err.message);
  }
}

// الحصول على طلب إرجاع معين
export async function getReturn(req, res) {
  try {
    const returnRequest = await Return.findById(req.params.id)
      .populate("originalSale")
      .populate("requestedBy", "name")
      .populate("approvedBy", "name")
      .populate("processedBy", "name")
      .populate("refund.electronicAccount", "name");
    
    if (!returnRequest) return error(res, "طلب الإرجاع غير موجود", 404);
    return success(res, returnRequest, "طلب الإرجاع");
  } catch (err) {
    console.error('Get return error:', err);
    return error(res, "فشل في جلب طلب الإرجاع", 500, err.message);
  }
}

// إلغاء طلب إرجاع
export async function cancelReturn(req, res) {
  try {
    const { id } = req.params;
    
    const returnRequest = await Return.findById(id);
    if (!returnRequest) return error(res, "طلب الإرجاع غير موجود", 404);

    if (returnRequest.status !== "pending") {
      return error(res, "لا يمكن إلغاء طلب الإرجاع هذا", 400);
    }

    returnRequest.status = "cancelled";
    await returnRequest.save();

    return success(res, returnRequest, "تم إلغاء طلب الإرجاع");
  } catch (err) {
    console.error('Cancel return error:', err);
    return error(res, "فشل في إلغاء طلب الإرجاع", 500, err.message);
  }
}

// تقرير المرتجعات
export async function getReturnsReport(req, res) {
  try {
    const { startDate, endDate, branch, type } = req.query;
    
    let filter = { status: "completed" }; // فقط المرتجعات المكتملة
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (branch) filter.branch = branch;
    if (type) filter.type = type;

    const returns = await Return.find(filter)
      .populate("originalSale", "invoiceNo")
      .populate("requestedBy", "name")
      .sort({ createdAt: -1 });

    // إحصائيات التقرير
    const totalReturns = returns.length;
    const totalRefundAmount = returns.reduce((sum, ret) => sum + Number(ret.netRefundAmount?.toString() || 0), 0);
    
    const typeStats = {
      full_return: 0,
      partial_return: 0,
      exchange: 0
    };

    returns.forEach(ret => {
      typeStats[ret.type] += 1;
    });

    const report = {
      totalReturns,
      totalRefundAmount,
      typeStats,
      returns,
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'النهاية'
      }
    };

    return success(res, report, "تقرير المرتجعات");
  } catch (err) {
    console.error('Returns report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}