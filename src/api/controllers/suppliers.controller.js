// src/api/controllers/suppliers.controller.js
import mongoose from "mongoose";
import Supplier from "../../models/Supplier.js";
import SupplierTransaction from "../../models/SupplierTransaction.js";
import { success, error } from "../../utils/responses.js";

// دالة للتحقق من صحة ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
}

// دالة للتحقق من query parameters
function validateQueryParams(query) {
  const errors = [];
  
  if (query.page && (!Number.isInteger(Number(query.page)) || Number(query.page) < 1)) {
    errors.push("رقم الصفحة يجب أن يكون رقماً صحيحاً أكبر من 0");
  }
  
  if (query.limit && (!Number.isInteger(Number(query.limit)) || Number(query.limit) < 1 || Number(query.limit) > 100)) {
    errors.push("عدد النتائج يجب أن يكون رقماً صحيحاً بين 1 و 100");
  }
  
  if (query.type && !["debt", "payment", "adjustment"].includes(query.type)) {
    errors.push("نوع الحركة يجب أن يكون debt أو payment أو adjustment");
  }
  
  if (query.activeOnly && !["true", "false"].includes(query.activeOnly)) {
    errors.push("activeOnly يجب أن تكون true أو false");
  }
  
  return errors;
}

/**
 * إنشاء تاجر جديد
 */
export async function createSupplier(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, phone, initialCashDebt = 0, initialGramsDebt = 0, notes } = req.body;
    
    // التحقق من عدم وجود تاجر بنفس الاسم
    const existingSupplier = await Supplier.findOne({ name });
    if (existingSupplier) {
      throw new Error("يوجد تاجر بنفس الاسم بالفعل");
    }

    const supplier = await Supplier.create([{
      name,
      phone,
      balanceCash: mongoose.Types.Decimal128.fromString(String(initialCashDebt)),
      balanceGrams: mongoose.Types.Decimal128.fromString(String(initialGramsDebt)),
      notes
    }], { session });

    // تسجيل الحركة الأولية إذا كان هناك دين
    if (initialCashDebt > 0 || initialGramsDebt > 0) {
      await SupplierTransaction.create([{
        supplier: supplier[0]._id,
        type: "debt",
        amountCash: mongoose.Types.Decimal128.fromString(String(initialCashDebt)),
        amountGrams: mongoose.Types.Decimal128.fromString(String(initialGramsDebt)),
        direction: "in",
        method: "initial_debt",
        note: "دين ابتدائي",
        recordedBy: req.user?._id
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();
    return success(res, supplier[0], "تم إنشاء التاجر بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إنشاء التاجر", 400, err.message);
  }
}

/**
 * قائمة جميع التجار
 */
export async function listSuppliers(req, res) {
  try {
    // التحقق من query parameters
    const queryErrors = validateQueryParams(req.query);
    if (queryErrors.length > 0) {
      return error(res, "بيانات غير صحيحة", 400, queryErrors);
    }
    
    const { activeOnly = 'true' } = req.query;
    let filter = {};
    if (activeOnly === 'true') {
      filter.isActive = true;
    }
    
    const suppliers = await Supplier.find(filter).sort({ name: 1 });
    
    const suppliersWithTotals = suppliers.map(supplier => ({
      ...supplier.toObject(),
      totalCashDebt: Number(supplier.balanceCash?.toString() || 0),
      totalGramsDebt: Number(supplier.balanceGrams?.toString() || 0)
    }));

    return success(res, suppliersWithTotals, "قائمة التجار");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب قائمة التجار", 500, err.message);
  }
}

/**
 * بيانات تاجر معين
 */
export async function getSupplier(req, res) {
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return error(res, "التاجر غير موجود", 404);

    const supplierData = {
      ...supplier.toObject(),
      totalCashDebt: Number(supplier.balanceCash?.toString() || 0),
      totalGramsDebt: Number(supplier.balanceGrams?.toString() || 0),
      totalPaidCash: Number(supplier.totalPaidCash?.toString() || 0),
      totalPaidGrams: Number(supplier.totalPaidGrams?.toString() || 0)
    };

    return success(res, supplierData, "بيانات التاجر");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب بيانات التاجر", 500, err.message);
  }
}

/**
 * تحديث بيانات تاجر
 */
export async function updateSupplier(req, res) {
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    const { name, phone, notes, isActive } = req.body;
    
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return error(res, "التاجر غير موجود", 404);

    // التحقق من عدم تكرار الاسم
    if (name && name !== supplier.name) {
      const existingSupplier = await Supplier.findOne({ name });
      if (existingSupplier) {
        return error(res, "يوجد تاجر بنفس الاسم بالفعل", 400);
      }
      supplier.name = name;
    }

    if (phone !== undefined) supplier.phone = phone;
    if (notes !== undefined) supplier.notes = notes;
    if (isActive !== undefined) supplier.isActive = isActive;

    await supplier.save();
    return success(res, supplier, "تم تحديث بيانات التاجر");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في تحديث بيانات التاجر", 400, err.message);
  }
}

/**
 * إضافة دين للتاجر (زيادة الدين)
 */
export async function addDebt(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    const supplierId = req.params.id;
    const { cashAmount = 0, gramsAmount = 0, note } = req.body;
    
    const cashAmt = Number(cashAmount);
    const gramsAmt = Number(gramsAmount);
    
    if (cashAmt <= 0 && gramsAmt <= 0) {
      throw new Error("يجب إدخال مبلغ نقدي أو جرامات");
    }

    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("التاجر غير موجود");

    // تحديث الرصيد
    if (cashAmt > 0) {
      const currentCash = Number(supplier.balanceCash?.toString() || 0);
      supplier.balanceCash = mongoose.Types.Decimal128.fromString(String(currentCash + cashAmt));
    }

    if (gramsAmt > 0) {
      const currentGrams = Number(supplier.balanceGrams?.toString() || 0);
      supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(currentGrams + gramsAmt));
    }

    await supplier.save({ session });

    // تسجيل الحركة
    await SupplierTransaction.create([{
      supplier: supplier._id,
      type: "debt",
      amountCash: mongoose.Types.Decimal128.fromString(String(cashAmt)),
      amountGrams: mongoose.Types.Decimal128.fromString(String(gramsAmt)),
      direction: "in",
      method: "manual_debt",
      note: note || "إضافة دين يدوي",
      recordedBy: req.user?._id
    }], { session });

    await session.commitTransaction();
    session.endSession();
    
    const updatedSupplier = await Supplier.findById(supplierId);
    return success(res, {
      supplier: updatedSupplier,
      addedDebt: { cash: cashAmt, grams: gramsAmt }
    }, "تم إضافة الدين للتاجر");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في إضافة الدين", 400, err.message);
  }
}

/**
 * سداد دين للتاجر (خصم من الدين)
 */
export async function paySupplier(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    const supplierId = req.params.id;
    const { cashAmount = 0, gramsAmount = 0, note } = req.body;
    
    const cashAmt = Number(cashAmount);
    const gramsAmt = Number(gramsAmount);
    
    if (cashAmt <= 0 && gramsAmt <= 0) {
      throw new Error("يجب إدخال مبلغ نقدي أو جرامات للسداد");
    }

    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("التاجر غير موجود");

    // التحقق من أن المبلغ المسدد لا يزيد عن الدين
    const currentCash = Number(supplier.balanceCash?.toString() || 0);
    const currentGrams = Number(supplier.balanceGrams?.toString() || 0);

    if (cashAmt > currentCash) {
      throw new Error(`المبلغ النقدي المسدد (${cashAmt}) أكبر من الدين النقدي (${currentCash})`);
    }

    if (gramsAmt > currentGrams) {
      throw new Error(`الجرامات المسددة (${gramsAmt}) أكبر من الدين بالجرامات (${currentGrams})`);
    }

    // تحديث الرصيد
    if (cashAmt > 0) {
      supplier.balanceCash = mongoose.Types.Decimal128.fromString(String(currentCash - cashAmt));
      const currentPaidCash = Number(supplier.totalPaidCash?.toString() || 0);
      supplier.totalPaidCash = mongoose.Types.Decimal128.fromString(String(currentPaidCash + cashAmt));
    }

    if (gramsAmt > 0) {
      supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(currentGrams - gramsAmt));
      const currentPaidGrams = Number(supplier.totalPaidGrams?.toString() || 0);
      supplier.totalPaidGrams = mongoose.Types.Decimal128.fromString(String(currentPaidGrams + gramsAmt));
    }

    await supplier.save({ session });

    // تسجيل الحركة
    await SupplierTransaction.create([{
      supplier: supplier._id,
      type: "payment",
      amountCash: mongoose.Types.Decimal128.fromString(String(cashAmt)),
      amountGrams: mongoose.Types.Decimal128.fromString(String(gramsAmt)),
      direction: "out",
      method: "manual_payment",
      note: note || "سداد دين يدوي",
      recordedBy: req.user?._id
    }], { session });

    await session.commitTransaction();
    session.endSession();
    
    const updatedSupplier = await Supplier.findById(supplierId);
    return success(res, {
      supplier: updatedSupplier,
      paidAmount: { cash: cashAmt, grams: gramsAmt }
    }, "تم سداد الدين بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في سداد الدين", 400, err.message);
  }
}

/**
 * تعديل دين التاجر (لتصحيح الأخطاء)
 */
export async function adjustDebt(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    const supplierId = req.params.id;
    const { newCashBalance, newGramsBalance, reason } = req.body;
    
    if (!reason) {
      throw new Error("يجب كتابة سبب التعديل");
    }

    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error("التاجر غير موجود");

    const oldCash = Number(supplier.balanceCash?.toString() || 0);
    const oldGrams = Number(supplier.balanceGrams?.toString() || 0);
    const newCash = Number(newCashBalance);
    const newGrams = Number(newGramsBalance);

    // تحديث الرصيد
    supplier.balanceCash = mongoose.Types.Decimal128.fromString(String(newCash));
    supplier.balanceGrams = mongoose.Types.Decimal128.fromString(String(newGrams));

    await supplier.save({ session });

    // حساب الفرق لتسجيله في الحركة
    const cashDiff = newCash - oldCash;
    const gramsDiff = newGrams - oldGrams;

    // تسجيل الحركة
    await SupplierTransaction.create([{
      supplier: supplier._id,
      type: "adjustment",
      amountCash: mongoose.Types.Decimal128.fromString(String(cashDiff)),
      amountGrams: mongoose.Types.Decimal128.fromString(String(gramsDiff)),
      direction: cashDiff >= 0 && gramsDiff >= 0 ? "in" : "out",
      method: "manual_adjustment",
      note: `تعديل رصيد - ${reason}`,
      recordedBy: req.user?._id
    }], { session });

    await session.commitTransaction();
    session.endSession();
    
    return success(res, {
      supplier,
      adjustment: {
        cash: { old: oldCash, new: newCash, difference: cashDiff },
        grams: { old: oldGrams, new: newGrams, difference: gramsDiff }
      }
    }, "تم تعديل الدين بنجاح");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل في تعديل الدين", 400, err.message);
  }
}

/**
 * قائمة حركات تاجر معين
 */
export async function listSupplierTransactions(req, res) {
  try {
    // التحقق من صحة الـ ID
    if (!isValidObjectId(req.params.id)) {
      return error(res, "معرف التاجر غير صحيح", 400);
    }
    
    // التحقق من query parameters
    const queryErrors = validateQueryParams(req.query);
    if (queryErrors.length > 0) {
      return error(res, "بيانات غير صحيحة", 400, queryErrors);
    }
    
    const supplierId = req.params.id;
    const { page = 1, limit = 50, type } = req.query;
    
    let filter = { supplier: supplierId };
    if (type) {
      filter.type = type;
    }
    
    const transactions = await SupplierTransaction.find(filter)
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page-1)*limit)
      .limit(Number(limit));
    
    const total = await SupplierTransaction.countDocuments(filter);
    
    return success(res, {
      transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, "حركات التاجر");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في جلب حركات التاجر", 500, err.message);
  }
}

/**
 * تقرير إجمالي الديون لجميع التجار
 */
export async function getSuppliersDebtReport(req, res) {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    
    const report = suppliers.map(supplier => ({
      _id: supplier._id,
      name: supplier.name,
      phone: supplier.phone,
      cashDebt: Number(supplier.balanceCash?.toString() || 0),
      gramsDebt: Number(supplier.balanceGrams?.toString() || 0),
      totalPaidCash: Number(supplier.totalPaidCash?.toString() || 0),
      totalPaidGrams: Number(supplier.totalPaidGrams?.toString() || 0)
    }));

    const totals = {
      totalCashDebt: report.reduce((sum, s) => sum + s.cashDebt, 0),
      totalGramsDebt: report.reduce((sum, s) => sum + s.gramsDebt, 0),
      totalPaidCash: report.reduce((sum, s) => sum + s.totalPaidCash, 0),
      totalPaidGrams: report.reduce((sum, s) => sum + s.totalPaidGrams, 0),
      suppliersCount: report.length
    };

    return success(res, {
      suppliers: report,
      totals
    }, "تقرير إجمالي ديون التجار");
  } catch (err) {
    console.error(err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}