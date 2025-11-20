// src/services/cash.service.js
import mongoose from "mongoose";
import CashMovement from "../models/CashMovement.js";
import Branch from "../models/Branch.js";

/**
 * recordCashMovement()
 * تسجيل أي حركة نقدية وتحديث رصيد الفرع
 */
export async function recordCashMovement(opts = {}) {
  const sessionProvided = Boolean(opts.session);
  const session = opts.session || await mongoose.startSession();

  try {
    if (!sessionProvided) session.startTransaction();

    const {
      branch,
      type,
      amount,
      reason,
      user,
      referenceType,
      referenceId,
      fromBranch,
      toBranch
    } = opts;

    // validations
    if (!type || !["deposit", "expense", "transfer"].includes(type)) {
      throw new Error("Invalid cash movement type");
    }

    const numericAmount = Number(amount);
    if (!isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid amount (must be a positive number)");
    }

    // determine which branch name to store on the movement for traceability
    const movementBranch = branch || (type === "transfer" ? fromBranch : undefined);

    // create movement document
    const mvData = {
      branch: movementBranch,
      type,
      amount: mongoose.Types.Decimal128.fromString(String(numericAmount)),
      reason: reason || "",
      user,
      referenceType: referenceType || undefined,
      referenceId: referenceId || undefined,
      fromBranch: fromBranch || undefined,
      toBranch: toBranch || undefined
    };

    const mv = await CashMovement.create([mvData], { session });
    const movement = mv[0];

    // update branch balances with safety checks
    if (type === "deposit") {
      if (!movementBranch) throw new Error("branch required for deposit");
      const br = await Branch.findOne({ code: movementBranch }).session(session);
      if (!br) throw new Error("branch not found: " + movementBranch);
      const cur = Number(br.cash_balance?.toString?.() || 0);
      br.cash_balance = mongoose.Types.Decimal128.fromString(String(cur + numericAmount));
      await br.save({ session });
    } else if (type === "expense") {
      if (!movementBranch) throw new Error("branch required for expense");
      const br = await Branch.findOne({ code: movementBranch }).session(session);
      if (!br) throw new Error("branch not found: " + movementBranch);
      const cur = Number(br.cash_balance?.toString?.() || 0);
      const newBalance = cur - numericAmount;
      if (newBalance < -0.0001) {
        throw new Error(`Insufficient cash balance in ${movementBranch} (current: ${cur}, withdraw: ${numericAmount})`);
      }
      br.cash_balance = mongoose.Types.Decimal128.fromString(String(newBalance));
      await br.save({ session });
    } else if (type === "transfer") {
      if (!fromBranch || !toBranch) throw new Error("fromBranch and toBranch required for transfer");

      const from = await Branch.findOne({ code: fromBranch }).session(session);
      const to = await Branch.findOne({ code: toBranch }).session(session);

      if (!from) throw new Error("fromBranch not found: " + fromBranch);
      if (!to) throw new Error("toBranch not found: " + toBranch);

      const curFrom = Number(from.cash_balance?.toString?.() || 0);
      const curTo = Number(to.cash_balance?.toString?.() || 0);

      const newFrom = curFrom - numericAmount;
      if (newFrom < -0.0001) {
        throw new Error(`Insufficient cash balance in ${fromBranch} (current: ${curFrom}, transfer: ${numericAmount})`);
      }

      from.cash_balance = mongoose.Types.Decimal128.fromString(String(newFrom));
      to.cash_balance = mongoose.Types.Decimal128.fromString(String(curTo + numericAmount));

      await from.save({ session });
      await to.save({ session });
    }

    if (!sessionProvided) await session.commitTransaction();
    if (!sessionProvided) session.endSession();

    return movement;
  } catch (err) {
    if (!sessionProvided) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
}

/**
 * reverseCashMovement()
 * عكس حركة محسنة مع تسجيل معلومات إضافية ومنع العكس المزدوج
 */
export async function reverseCashMovement(movementId, { user, reason = "عكس الحركة" }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // البحث عن الحركة الأصلية
    const originalMovement = await CashMovement.findById(movementId).session(session);
    if (!originalMovement) {
      throw new Error("الحركة غير موجودة");
    }

    // التحقق إذا كانت الحركة معكوسة مسبقاً
    if (originalMovement.reversed) {
      throw new Error("الحركة معكوسة مسبقاً");
    }

    const amount = Number(originalMovement.amount?.toString() || 0);
    if (!isFinite(amount) || amount <= 0) {
      throw new Error("مبلغ الحركة غير صالح للعكس");
    }

    // إنشاء حركة معاكسة بناءً على نوع الحركة الأصلية
    if (originalMovement.type === "deposit") {
      // reverse deposit -> expense on same branch
      await recordCashMovement({
        session,
        branch: originalMovement.branch,
        type: "expense",
        amount,
        reason: reason || `عكس حركة ${originalMovement._id}`,
        user: user
      });
    } else if (originalMovement.type === "expense") {
      // reverse expense -> deposit on same branch
      await recordCashMovement({
        session,
        branch: originalMovement.branch,
        type: "deposit",
        amount,
        reason: reason || `عكس حركة ${originalMovement._id}`,
        user: user
      });
    } else if (originalMovement.type === "transfer") {
      // reverse transfer: transfer from toBranch back to fromBranch
      if (!originalMovement.fromBranch || !originalMovement.toBranch) {
        throw new Error("بيانات الفروع الأصلية للتحويل غير مكتملة");
      }
      await recordCashMovement({
        session,
        fromBranch: originalMovement.toBranch,
        toBranch: originalMovement.fromBranch,
        type: "transfer",
        amount,
        reason: reason || `عكس تحويل ${originalMovement._id}`,
        user: user
      });
    }

    // تحديث الحركة الأصلية لتسجيل معلومات العكس
    originalMovement.reversed = true;
    originalMovement.reversedAt = new Date();
    originalMovement.reversedBy = user;
    await originalMovement.save({ session });

    await session.commitTransaction();
    
    return {
      originalMovement,
      message: "تم عكس الحركة بنجاح"
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * updateCashMovement()
 * تعديل حركة نقدية موجودة
 */
export async function updateCashMovement(movementId, updateData, { user, reason }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // البحث عن الحركة الأصلية
    const originalMovement = await CashMovement.findById(movementId).session(session);
    if (!originalMovement) {
      throw new Error("الحركة غير موجودة");
    }

    // التحقق إذا كانت الحركة معكوسة
    if (originalMovement.reversed) {
      throw new Error("لا يمكن تعديل حركة معكوسة");
    }

    // حفظ نسخة من البيانات الأصلية قبل التعديل
    const originalAmount = Number(originalMovement.amount?.toString() || 0);
    const originalType = originalMovement.type;
    const originalBranch = originalMovement.branch;
    const originalFromBranch = originalMovement.fromBranch;
    const originalToBranch = originalMovement.toBranch;

    // الحقول المسموح بتعديلها
    const allowedUpdates = ['amount', 'reason', 'type', 'branch', 'fromBranch', 'toBranch'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // إذا لم يكن هناك تغييرات
    if (Object.keys(updates).length === 0) {
      throw new Error("لا توجد تغييرات لتطبيقها");
    }

    // التحقق من صحة البيانات المحدثة
    if (updates.amount !== undefined) {
      const newAmount = Number(updates.amount);
      if (!isFinite(newAmount) || newAmount <= 0) {
        throw new Error("المبلغ يجب أن يكون رقم موجب");
      }
      updates.amount = mongoose.Types.Decimal128.fromString(String(newAmount));
    }

    // تطبيق التحديثات
    Object.assign(originalMovement, updates);
    originalMovement.updatedBy = user;
    originalMovement.updateReason = reason;
    
    await originalMovement.save({ session });

    // تحديث أرصدة الفروع بناءً على التغييرات
    await updateBranchBalancesOnEdit(
      originalMovement, 
      { 
        amount: originalAmount, 
        type: originalType, 
        branch: originalBranch, 
        fromBranch: originalFromBranch, 
        toBranch: originalToBranch 
      },
      session
    );

    await session.commitTransaction();
    
    return {
      updatedMovement: originalMovement,
      message: "تم تعديل الحركة بنجاح"
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * updateBranchBalancesOnEdit()
 * تحديث أرصدة الفروع عند تعديل حركة
 */
async function updateBranchBalancesOnEdit(updatedMovement, originalData, session) {
  const newAmount = Number(updatedMovement.amount?.toString() || 0);
  const newType = updatedMovement.type;
  const newBranch = updatedMovement.branch;
  const newFromBranch = updatedMovement.fromBranch;
  const newToBranch = updatedMovement.toBranch;

  const originalAmount = originalData.amount;
  const originalType = originalData.type;
  const originalBranch = originalData.branch;
  const originalFromBranch = originalData.fromBranch;
  const originalToBranch = originalData.toBranch;

  // التراجع عن التأثير الأصلي
  await reverseOriginalEffect(originalData, session);

  // تطبيق التأثير الجديد
  await applyNewEffect({
    type: newType,
    amount: newAmount,
    branch: newBranch,
    fromBranch: newFromBranch,
    toBranch: newToBranch
  }, session);
}

/**
 * reverseOriginalEffect()
 * التراجع عن تأثير الحركة الأصلية
 */
async function reverseOriginalEffect(originalData, session) {
  const { type, amount, branch, fromBranch, toBranch } = originalData;

  if (type === 'deposit') {
    // التراجع عن إيداع: خصم من الرصيد
    if (branch) {
      const br = await Branch.findOne({ code: branch }).session(session);
      if (br) {
        const currentBalance = Number(br.cash_balance?.toString() || 0);
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(currentBalance - amount));
        await br.save({ session });
      }
    }
  } else if (type === 'expense') {
    // التراجع عن مصروف: إضافة للرصيد
    if (branch) {
      const br = await Branch.findOne({ code: branch }).session(session);
      if (br) {
        const currentBalance = Number(br.cash_balance?.toString() || 0);
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(currentBalance + amount));
        await br.save({ session });
      }
    }
  } else if (type === 'transfer') {
    // التراجع عن تحويل: إرجاع للمصدر وخصم من الهدف
    if (fromBranch) {
      const fromBr = await Branch.findOne({ code: fromBranch }).session(session);
      if (fromBr) {
        const currentFromBalance = Number(fromBr.cash_balance?.toString() || 0);
        fromBr.cash_balance = mongoose.Types.Decimal128.fromString(String(currentFromBalance + amount));
        await fromBr.save({ session });
      }
    }
    if (toBranch) {
      const toBr = await Branch.findOne({ code: toBranch }).session(session);
      if (toBr) {
        const currentToBalance = Number(toBr.cash_balance?.toString() || 0);
        toBr.cash_balance = mongoose.Types.Decimal128.fromString(String(currentToBalance - amount));
        await toBr.save({ session });
      }
    }
  }
}

/**
 * applyNewEffect()
 * تطبيق تأثير الحركة الجديدة
 */
async function applyNewEffect(newData, session) {
  const { type, amount, branch, fromBranch, toBranch } = newData;

  if (type === 'deposit') {
    if (branch) {
      const br = await Branch.findOne({ code: branch }).session(session);
      if (br) {
        const currentBalance = Number(br.cash_balance?.toString() || 0);
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(currentBalance + amount));
        await br.save({ session });
      }
    }
  } else if (type === 'expense') {
    if (branch) {
      const br = await Branch.findOne({ code: branch }).session(session);
      if (br) {
        const currentBalance = Number(br.cash_balance?.toString() || 0);
        const newBalance = currentBalance - amount;
        // التحقق من الرصيد الكافي
        if (newBalance < -0.0001) {
          throw new Error(`الرصيد غير كافي في الفرع ${branch}`);
        }
        br.cash_balance = mongoose.Types.Decimal128.fromString(String(newBalance));
        await br.save({ session });
      }
    }
  } else if (type === 'transfer') {
    if (fromBranch && toBranch) {
      const fromBr = await Branch.findOne({ code: fromBranch }).session(session);
      const toBr = await Branch.findOne({ code: toBranch }).session(session);

      if (!fromBr || !toBr) {
        throw new Error("أحد الفروع غير موجود");
      }

      const currentFromBalance = Number(fromBr.cash_balance?.toString() || 0);
      const newFromBalance = currentFromBalance - amount;
      
      if (newFromBalance < -0.0001) {
        throw new Error(`الرصيد غير كافي في الفرع ${fromBranch}`);
      }

      const currentToBalance = Number(toBr.cash_balance?.toString() || 0);
      const newToBalance = currentToBalance + amount;

      fromBr.cash_balance = mongoose.Types.Decimal128.fromString(String(newFromBalance));
      toBr.cash_balance = mongoose.Types.Decimal128.fromString(String(newToBalance));

      await fromBr.save({ session });
      await toBr.save({ session });
    }
  }
}

/**
 * reconcileAllBranches()
 * يجمع الحركات حسب الفرع ويقارنها مع branch.cash_balance
 */
export async function reconcileAllBranches() {
  // aggregate cash movements grouped by branch
  const agg = await CashMovement.aggregate([
    {
      $group: {
        _id: "$branch",
        net: { $sum: { $toDouble: "$amount" } },
        count: { $sum: 1 }
      }
    }
  ]);

  const diffs = [];
  for (const row of agg) {
    const br = await Branch.findOne({ code: row._id });
    const recorded = br ? Number(br.cash_balance?.toString?.() || 0) : 0;
    const computed = Number(row.net || 0);

    if (Math.abs(recorded - computed) > 0.001) {
      diffs.push({
        branch: row._id,
        recorded,
        computed,
        diff: computed - recorded,
        movementsCount: row.count
      });
    }
  }

  return diffs;
}