// src/api/controllers/cash.controller.js
import mongoose from "mongoose";
import { success, error } from "../../utils/responses.js";
import {
  recordCashMovement,
  reconcileAllBranches,
  reverseCashMovement
} from "../../services/cash.service.js";
import CashMovement from "../../models/CashMovement.js";

/**
 * Helper: حساب مجموع الفئات (تأكدنا من تحويل للقيم الرقمية)
 */
function calculateTotalFromBills(bills = {}) {
  const b200 = Number(bills["200"] || 0);
  const b100 = Number(bills["100"] || 0);
  const b50 = Number(bills["50"] || 0);
  const b20 = Number(bills["20"] || 0);
  const b10 = Number(bills["10"] || 0);
  const b5 = Number(bills["5"] || 0);

  return b200 * 200 + b100 * 100 + b50 * 50 + b20 * 20 + b10 * 10 + b5 * 5;
}

/**
 * إضافة حركة نقدية عادية (إيداع – مصروف – إلخ)
 * الفرع يفرض من req.user.branch (ما لم يكن الأدمن يرسل referenceBranch صراحةً)
 */
export async function createCashMovement(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // لو الأدمن عايز يسجل لحساب فرع آخر، ممكن يرسل field referenceBranch
    // لكن بشكل افتراضي الفرع المربوط بالمستخدم هو المرجع
    const userBranch = req.user?.branch || req.body.branch || null;

    const data = req.body;
    if (!data.type || data.amount == null) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "نوع الحركة والمبلغ مطلوبان", 400);
    }

    // تحقق مبسط على النوع
    if (!["deposit", "expense", "transfer"].includes(data.type)) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "نوع الحركة غير مدعوم", 400);
    }

    // لِـ transfer تأكد وجود from/to
    if (data.type === "transfer") {
      const fromBranch = data.fromBranch || userBranch;
      const toBranch = data.toBranch || data.to;
      if (!fromBranch || !toBranch) {
        await session.abortTransaction();
        session.endSession();
        return error(res, "لتحويل الأموال يجب تحديد fromBranch و toBranch", 400);
      }
    } else {
      // deposit/expense يجب أن يكون هناك فرع (إمّا من اليوزر أو من body)
      if (!userBranch) {
        await session.abortTransaction();
        session.endSession();
        return error(res, "الفرع غير محدد للمستخدم. لا يمكن تسجيل حركة نقدية.", 400);
      }
    }

    const mv = await recordCashMovement({
      session,
      branch: userBranch,
      type: data.type,
      amount: Number(data.amount),
      reason: data.reason || "",
      user: req.user._id,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      fromBranch: data.fromBranch || undefined,
      toBranch: data.toBranch || data.to || undefined
    });

    await session.commitTransaction();
    session.endSession();

    return success(res, mv, "تم تسجيل حركة نقدية", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("createCashMovement error:", err);
    return error(res, "فشل في تسجيل الحركة", 400, err.message);
  }
}

/**
 * قائمة كل الحركات النقدية
 * المسؤولون فقط (routes يحدد permit)
 */
export async function listCash(req, res) {
  try {
    const items = await CashMovement.find()
      .populate("user", "name")
      .sort({ createdAt: -1 });

    return success(res, items, "حركات النقد");
  } catch (err) {
    console.error("listCash error:", err);
    return error(res, "فشل في جلب الحركات", 500, err.message);
  }
}

/**
 * تحويل بين فروع (يقوم المستخدم بتحويل من فرعه افتراضياً)
 */
export async function cashTransfer(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { toBranch, amount, notes } = req.body;
    const fromBranch = req.user?.branch;

    if (!fromBranch || !toBranch || amount == null) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "بيانات التحويل ناقصة (fromBranch, toBranch, amount)", 400);
    }

    const mv = await recordCashMovement({
      session,
      type: "transfer",
      fromBranch,
      toBranch,
      amount: Number(amount),
      reason: notes || `تحويل ${fromBranch} -> ${toBranch}`,
      user: req.user._id
    });

    await session.commitTransaction();
    session.endSession();

    return success(res, mv, "تم التحويل بنجاح", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("cashTransfer error:", err);
    return error(res, "فشل في التحويل", 400, err.message);
  }
}

/**
 * فتح اليوم (تسجيل إيداع افتتاحي)
 */
export async function dailyOpening(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const branch = req.user?.branch;
    const { openingBills } = req.body;
    if (!openingBills) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "بيانات الفتح ناقصة", 400);
    }

    const total = calculateTotalFromBills(openingBills);

    const mv = await recordCashMovement({
      session,
      branch,
      type: "deposit",
      amount: Number(total),
      reason: "إيداع افتتاحي - فتح اليوم",
      user: req.user._id,
      referenceType: "dailyOpening"
    });

    await session.commitTransaction();
    session.endSession();

    return success(res, mv, "تم فتح اليوم وتسجيل الإيداع", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("dailyOpening error:", err);
    return error(res, "فشل في فتح اليوم", 400, err.message);
  }
}

/**
 * غلق اليوم (تسجيل سحب/مصروف + تحويلات داخلية)
 */
export async function dailyClosing(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const branch = req.user?.branch;
    const { closingBills, storeTransfers = [] } = req.body;

    if (!closingBills) {
      await session.abortTransaction();
      session.endSession();
      return error(res, "بيانات الإغلاق ناقصة", 400);
    }

    const total = calculateTotalFromBills(closingBills);

    // سحب نهاية اليوم (مصروف)
    const mv = await recordCashMovement({
      session,
      branch,
      type: "expense",
      amount: Number(total),
      reason: "سحب إغلاق اليوم",
      user: req.user._id,
      referenceType: "dailyClosing"
    });

    // تحويلات داخلية خلال اليوم (قد تكون متعددة)
    for (const t of storeTransfers) {
      // تحقق بسيط
      if (!t.toBranch || t.amount == null) {
        // تجاهل السطر أو يمكنك رمي خطأ؛ هنا نختار إلغاء العملية كلها لإبقاء الاتساق
        await session.abortTransaction();
        session.endSession();
        return error(res, "أحد عناصر التحويل الداخلي ناقص (toBranch أو amount)", 400);
      }

      await recordCashMovement({
        session,
        type: "transfer",
        fromBranch: branch,
        toBranch: t.toBranch,
        amount: Number(t.amount),
        reason: t.notes || `تحويل داخلي - ${branch} -> ${t.toBranch}`,
        user: req.user._id
      });
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, mv, "تم إغلاق اليوم وتسجيل الحركات", 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("dailyClosing error:", err);
    return error(res, "فشل في غلق اليوم", 400, err.message);
  }
}

/**
 * نقطة للمقارنة بين أرصدة الفروع (admin)
 */
export async function reconcile(req, res) {
  try {
    const diffs = await reconcileAllBranches();
    return success(res, diffs, "نتائج المصالحة");
  } catch (err) {
    console.error("reconcile error:", err);
    return error(res, "فشل في المصالحة", 500, err.message);
  }
}

/**
 * عكس حركة نقدية (مثلاً لو عايز تتراجع عن تسجيل)
 * استخدم reverseCashMovement من service (transaction داخلها)
 */
export async function reverseMovement(req, res) {
  try {
    const { id } = req.params;
    if (!id) return error(res, "معرف الحركة مطلوب", 400);

    const result = await reverseCashMovement(id, { user: req.user._id });
    return success(res, result, "تم عكس الحركة");
  } catch (err) {
    console.error("reverseMovement error:", err);
    return error(res, "فشل في عكس الحركة", 500, err.message);
  }
}
