// src/services/cash.service.js
import mongoose from "mongoose";
import CashMovement from "../models/CashMovement.js";
import Branch from "../models/Branch.js";

/**
 * recordCashMovement()
 * تسجيل أي حركة نقدية وتحديث رصيد الفرع
 *
 * opts = {
 *   session,         // mongoose session (optional)
 *   branch,          // اسم الفرع المتأثر (string) - يستخدم للـ deposit/expense
 *   type,            // "deposit" | "expense" | "transfer"
 *   amount,          // number (موجب)
 *   reason,          // string
 *   user,            // user id
 *   referenceType,   // optional string
 *   referenceId,     // optional ObjectId
 *   fromBranch,      // for transfer
 *   toBranch         // for transfer
 * }
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
    // for transfer we'll keep branch field undefined (or could set to fromBranch) —
    // here we set branch to the 'branch' param if provided, otherwise for transfer use fromBranch.
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
      // Optional: block if negative (or allow negative if business requires)
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
 * عكس أي حركة عند الحاجة (مثلاً عند حذف فاتورة)
 */
export async function reverseCashMovement(movementId, opts = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const mv = await CashMovement.findById(movementId).session(session);
    if (!mv) throw new Error("Movement not found");

    const amount = Number(mv.amount?.toString() || 0);
    if (!isFinite(amount) || amount <= 0) throw new Error("Invalid movement amount to reverse");

    if (mv.type === "deposit") {
      // reverse deposit -> expense on same branch
      await recordCashMovement({
        session,
        branch: mv.branch,
        type: "expense",
        amount,
        reason: `عكس حركة ${mv._id}`,
        user: opts.user
      });
    } else if (mv.type === "expense") {
      // reverse expense -> deposit on same branch
      await recordCashMovement({
        session,
        branch: mv.branch,
        type: "deposit",
        amount,
        reason: `عكس حركة ${mv._id}`,
        user: opts.user
      });
    } else if (mv.type === "transfer") {
      // reverse transfer: transfer from toBranch back to fromBranch
      if (!mv.fromBranch || !mv.toBranch) throw new Error("original transfer branches missing");
      await recordCashMovement({
        session,
        fromBranch: mv.toBranch,
        toBranch: mv.fromBranch,
        type: "transfer",
        amount,
        reason: `عكس تحويل ${mv._id}`,
        user: opts.user
      });
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
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
