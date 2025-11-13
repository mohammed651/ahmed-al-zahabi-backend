import ElectronicAccount from "../../models/ElectronicAccount.js";
import ElectronicTransaction from "../../models/ElectronicTransaction.js";
import { error, success } from "../../utils/responses.js";


export async function createElectronicAccount(req, res) {
  try {
    const { name, description, type, color, icon } = req.body;
    
    const existing = await ElectronicAccount.findOne({ name });
    if (existing) {
      return error(res, "اسم طريقة الدفع موجود مسبقاً", 400);
    }

    const account = await ElectronicAccount.create({
      name,
      description,
      type: type || "other",
      color: color || "#3B82F6",
      icon: icon || "💳",
      currentBalance: 0
    });

    return success(res, account, "تم إنشاء طريقة الدفع بنجاح", 201);
  } catch (err) {
    return error(res, "فشل في إنشاء طريقة الدفع", 400, err.message);
  }
}

export async function updateElectronicAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, description, type, color, icon, status } = req.body;
    
    const account = await ElectronicAccount.findById(id);
    if (!account) {
      return error(res, "طريقة الدفع غير موجودة", 404);
    }

    if (name && name !== account.name) {
      const existing = await ElectronicAccount.findOne({ name });
      if (existing) {
        return error(res, "اسم طريقة الدفع موجود مسبقاً", 400);
      }
      account.name = name;
    }

    if (description !== undefined) account.description = description;
    if (type) account.type = type;
    if (color) account.color = color;
    if (icon) account.icon = icon;
    if (status) account.status = status;

    await account.save();
    return success(res, account, "تم تحديث طريقة الدفع بنجاح");
  } catch (err) {
    return error(res, "فشل في تحديث طريقة الدفع", 400, err.message);
  }
}

export async function deleteElectronicAccount(req, res) {
  try {
    const { id } = req.params;
    
    const account = await ElectronicAccount.findById(id);
    if (!account) {
      return error(res, "طريقة الدفع غير موجودة", 404);
    }

    account.status = "inactive";
    await account.save();

    return success(res, null, "تم تعطيل طريقة الدفع بنجاح");
  } catch (err) {
    return error(res, "فشل في تعطيل طريقة الدفع", 400, err.message);
  }
}

export async function getElectronicAccounts(req, res) {
  try {
    const { status = "active" } = req.query;
    
    const filter = {};
    if (status !== "all") {
      filter.status = status;
    }

    const accounts = await ElectronicAccount.find(filter).sort({ createdAt: -1 });
    return success(res, accounts, "قائمة طرق الدفع الإلكترونية");
  } catch (err) {
    return error(res, "فشل في جلب طرق الدفع", 400, err.message);
  }
}

export async function transferToCash(req, res) {
  try {
    const { accountId, amount, branch, notes } = req.body;
    
    const account = await ElectronicAccount.findById(accountId);
    if (!account) return error(res, "الحساب غير موجود", 404);
    if (account.status !== "active") return error(res, "الحساب غير نشط", 400);
    
    const currentBalance = Number(account.currentBalance?.toString() || 0);
    if (currentBalance < amount) {
      return error(res, "الرصيد غير كافي", 400);
    }
    
    account.currentBalance = currentBalance - Number(amount);
    await account.save();
    
    await ElectronicTransaction.create({
      account: accountId,
      type: "withdrawal",
      amount: -Number(amount),
      reference: `تحويل للخزنة - ${branch}`,
      notes: notes || `تحويل لخزنة ${branch}`,
      recordedBy: req.user._id
    });
    
    return success(res, { 
      account: account,
      transferredAmount: amount 
    }, "تم التحويل للخزنة بنجاح");
  } catch (err) {
    return error(res, "فشل في التحويل", 400, err.message);
  }
}

export async function depositToElectronic(req, res) {
  try {
    const { accountId, amount, notes } = req.body;
    
    const account = await ElectronicAccount.findById(accountId);
    if (!account) return error(res, "الحساب غير موجود", 404);
    
    const currentBalance = Number(account.currentBalance?.toString() || 0);
    account.currentBalance = currentBalance + Number(amount);
    await account.save();
    
    await ElectronicTransaction.create({
      account: accountId,
      type: "deposit",
      amount: Number(amount),
      reference: "إيداع يدوي",
      notes: notes || "إيداع لتصحيح الرصيد",
      recordedBy: req.user._id
    });
    
    return success(res, account, "تم الإيداع بنجاح");
  } catch (err) {
    return error(res, "فشل في الإيداع", 400, err.message);
  }
}