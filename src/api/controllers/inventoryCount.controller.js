// src/api/controllers/inventoryCount.controller.js
import mongoose from "mongoose";
import InventoryCount from "../../models/InventoryCount.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { generateCountNumber } from "../../utils/generateCountNumber.js";
import { success, error } from "../../utils/responses.js";

// إنشاء جرد جديد
export async function createInventoryCount(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { 
      title,
      branch,
      type = "scheduled",
      countDate = new Date(),
      notes
    } = req.body;

    // جلب جميع المنتجات للفرع
    const products = await Product.find({ 
      $or: [
        { count_in_store: { $gt: 0 } },
        { count_in_showcase: { $gt: 0 } }
      ]
    }).session(session);

    if (products.length === 0) {
      await session.abortTransaction();
      return error(res, "لا توجد منتجات في المخزون", 400);
    }

    // تحضير المنتجات للجرد
    const countedProducts = products.map(product => ({
      product: product._id,
      productName: product.name,
      productCode: product.code,
      karat: product.karat,
      expectedCount: (product.count_in_store || 0) + (product.count_in_showcase || 0),
      actualCount: 0, // سيتم عدها لاحقاً
      countedBy: req.user._id
    }));

    const countNumber = generateCountNumber();
    
    const inventoryCount = await InventoryCount.create([{
      countNumber,
      title,
      branch,
      type,
      countDate,
      countedProducts,
      countedBy: [req.user._id],
      notes,
      status: "counting",
      startTime: new Date()
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return success(res, inventoryCount[0], "تم إنشاء الجرد بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create inventory count error:', err);
    return error(res, "فشل في إنشاء الجرد", 500, err.message);
  }
}

// تحديث العدد الفعلي لمنتج في الجرد
export async function updateProductCount(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { productId, actualCount, notes } = req.body;

    const inventoryCount = await InventoryCount.findById(id).session(session);
    if (!inventoryCount) {
      await session.abortTransaction();
      return error(res, "الجرد غير موجود", 404);
    }

    if (inventoryCount.status !== "counting") {
      await session.abortTransaction();
      return error(res, "لا يمكن تحديث الجرد في هذه الحالة", 400);
    }

    const productIndex = inventoryCount.countedProducts.findIndex(
      p => p.product.toString() === productId
    );

    if (productIndex === -1) {
      await session.abortTransaction();
      return error(res, "المنتج غير موجود في الجرد", 404);
    }

    // تحديث العدد الفعلي
    inventoryCount.countedProducts[productIndex].actualCount = actualCount;
    inventoryCount.countedProducts[productIndex].notes = notes;
    inventoryCount.countedProducts[productIndex].countedBy = req.user._id;

    await inventoryCount.save({ session });
    await session.commitTransaction();
    session.endSession();

    return success(res, inventoryCount, "تم تحديث العدد الفعلي بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update product count error:', err);
    return error(res, "فشل في تحديث العدد الفعلي", 500, err.message);
  }
}

// إنهاء الجرد والانتقال للمراجعة
export async function completeCounting(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    const inventoryCount = await InventoryCount.findById(id).session(session);
    if (!inventoryCount) {
      await session.abortTransaction();
      return error(res, "الجرد غير موجود", 404);
    }

    if (inventoryCount.status !== "counting") {
      await session.abortTransaction();
      return error(res, "لا يمكن إنهاء الجرد في هذه الحالة", 400);
    }

    // التحقق من أن جميع المنتجات تم عدها
    const notCounted = inventoryCount.countedProducts.filter(
      p => p.actualCount === 0 && p.expectedCount > 0
    );

    if (notCounted.length > 0) {
      await session.abortTransaction();
      return error(res, `يوجد ${notCounted.length} منتج لم يتم عدها`, 400);
    }

    inventoryCount.status = "review";
    inventoryCount.endTime = new Date();
    
    await inventoryCount.save({ session });
    await session.commitTransaction();
    session.endSession();

    return success(res, inventoryCount, "تم إنهاء الجرد بنجاح وجاهز للمراجعة");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Complete counting error:', err);
    return error(res, "فشل في إنهاء الجرد", 500, err.message);
  }
}

// الموافقة على الجرد وتسوية الفروق
export async function approveInventoryCount(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { adjustmentNotes, autoAdjust = false } = req.body;

    const inventoryCount = await InventoryCount.findById(id).session(session);
    if (!inventoryCount) {
      await session.abortTransaction();
      return error(res, "الجرد غير موجود", 404);
    }

    if (inventoryCount.status !== "review") {
      await session.abortTransaction();
      return error(res, "لا يمكن الموافقة على الجرد في هذه الحالة", 400);
    }

    // تسوية الفروق تلقائياً إذا طلب المستخدم
    if (autoAdjust) {
      for (const countedProduct of inventoryCount.countedProducts) {
        const product = await Product.findById(countedProduct.product).session(session);
        if (product && countedProduct.difference !== 0) {
          // تحديث المخزون ليطابق العدد الفعلي
          const totalExpected = countedProduct.expectedCount;
          const totalActual = countedProduct.actualCount;
          
          // نفترض أن الفرق في المستودع (يمكن تعديل المنطق حسب احتياجك)
          product.count_in_store = totalActual;
          
          await product.save({ session });
          
          // تسجيل حركة المخزون للتسوية
          await StockMovement.create([{
            product: product._id,
            type: "adjustment",
            from: "inventory_count",
            to: "inventory_count",
            quantity: Math.abs(countedProduct.difference),
            performedByEmployeeName: req.user.name,
            recordedBy: req.user._id,
            notes: `تسوية جرد - ${inventoryCount.countNumber} - الفرق: ${countedProduct.difference}`
          }], { session });
        }
      }
    }

    inventoryCount.status = "completed";
    inventoryCount.adjustmentNotes = adjustmentNotes;
    inventoryCount.approvedBy = req.user._id;
    
    await inventoryCount.save({ session });
    await session.commitTransaction();
    session.endSession();

    return success(res, inventoryCount, "تم الموافقة على الجرد بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Approve inventory count error:', err);
    return error(res, "فشل في الموافقة على الجرد", 500, err.message);
  }
}

// قائمة عمليات الجرد
export async function listInventoryCounts(req, res) {
  try {
    const { page = 1, limit = 50, status, branch, type } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (branch) filter.branch = branch;
    if (type) filter.type = type;
    
    const counts = await InventoryCount.find(filter)
      .populate("countedBy", "name")
      .populate("reviewedBy", "name")
      .populate("approvedBy", "name")
      .populate("countedProducts.countedBy", "name")
      .sort({ createdAt: -1 })
      .skip((page-1)*limit)
      .limit(Number(limit));

    const total = await InventoryCount.countDocuments(filter);

    return success(res, {
      counts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "قائمة عمليات الجرد");
  } catch (err) {
    console.error('List inventory counts error:', err);
    return error(res, "فشل في جلب عمليات الجرد", 500, err.message);
  }
}

// الحصول على جرد معين
export async function getInventoryCount(req, res) {
  try {
    const count = await InventoryCount.findById(req.params.id)
      .populate("countedBy", "name")
      .populate("reviewedBy", "name")
      .populate("approvedBy", "name")
      .populate("countedProducts.countedBy", "name")
      .populate("countedProducts.product", "name code karat weight pricePerGram count_in_store count_in_showcase");
    
    if (!count) return error(res, "الجرد غير موجود", 404);
    return success(res, count, "بيانات الجرد");
  } catch (err) {
    console.error('Get inventory count error:', err);
    return error(res, "فشل في جلب بيانات الجرد", 500, err.message);
  }
}

// جرد سريع لمنتج معين
export async function quickCount(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, productId, actualCount, notes } = req.body;

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return error(res, "المنتج غير موجود", 404);
    }

    const expectedCount = (product.count_in_store || 0) + (product.count_in_showcase || 0);
    const difference = actualCount - expectedCount;

    // تحديث المخزون إذا كان هناك فرق
    if (difference !== 0) {
      product.count_in_store = actualCount; // أو المنطق المناسب لتوزيع الفرق
      await product.save({ session });
      
      await StockMovement.create([{
        product: product._id,
        type: "adjustment",
        from: "quick_count",
        to: "quick_count",
        quantity: Math.abs(difference),
        performedByEmployeeName: req.user.name,
        recordedBy: req.user._id,
        notes: `جرد سريع - الفرق: ${difference} - ${notes || ''}`
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, {
      product: product.toJSON(),
      count: {
        expected: expectedCount,
        actual: actualCount,
        difference: difference
      }
    }, "تم الجرد السريع بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Quick count error:', err);
    return error(res, "فشل في الجرد السريع", 500, err.message);
  }
}

// تقرير الجرد
export async function getInventoryReport(req, res) {
  try {
    const { startDate, endDate, branch } = req.query;
    
    let filter = { status: "completed" };
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (branch) filter.branch = branch;

    const counts = await InventoryCount.find(filter)
      .populate("countedBy", "name")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });

    // إحصائيات التقرير
    const totalCounts = counts.length;
    const totalProductsCounted = counts.reduce((sum, count) => sum + count.totalProducts, 0);
    const totalDifferences = counts.reduce((sum, count) => sum + count.totalDifference, 0);
    
    const statusStats = {
      completed: 0,
      adjusted: 0
    };

    counts.forEach(count => {
      statusStats[count.status] += 1;
    });

    const report = {
      totalCounts,
      totalProductsCounted,
      totalDifferences,
      statusStats,
      counts,
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'النهاية'
      }
    };

    return success(res, report, "تقرير الجرد");
  } catch (err) {
    console.error('Inventory report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}