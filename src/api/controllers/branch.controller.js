// src/api/controllers/branch.controller.js
import Branch from "../../models/Branch.js";

export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find().select('-__v');
    
    // تحويل Decimal128 إلى number لسهولة الاستخدام في frontend
    const branchesWithNumbers = branches.map(branch => ({
      ...branch.toObject(),
      cash_balance: parseFloat(branch.cash_balance) || 0
    }));
    
    res.json({
      success: true,
      message: "الفروع",
      data: branchesWithNumbers
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الفروع",
      error: error.message
    });
  }
};

export const getBranch = async (req, res) => {
  try {
    // البحث بالكود بدل الـ ID
    const branch = await Branch.findOne({ code: req.params.code }).select('-__v');
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "الفرع غير موجود"
      });
    }

    // تحويل Decimal128 إلى number
    const branchData = {
      ...branch.toObject(),
      cash_balance: parseFloat(branch.cash_balance) || 0
    };

    res.json({
      success: true,
      message: "بيانات الفرع",
      data: branchData
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب بيانات الفرع",
      error: error.message
    });
  }
};

// جلب فرع المستخدم الحالي
export const getUserBranch = async (req, res) => {
  try {
    // المستخدم الحالي من الـ auth middleware
    const user = req.user;
    
    if (!user || !user.branch) {
      return res.status(404).json({
        success: false,
        message: "المستخدم ليس مرتبط بفرع"
      });
    }

    // البحث بالكود المخزن في user.branch
    const branch = await Branch.findOne({ code: user.branch }).select('-__v');
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "فرع المستخدم غير موجود"
      });
    }

    // تحويل Decimal128 إلى number
    const branchData = {
      ...branch.toObject(),
      cash_balance: parseFloat(branch.cash_balance) || 0
    };

    res.json({
      success: true,
      message: "فرع المستخدم الحالي",
      data: branchData
    });
  } catch (error) {
    console.error('Error fetching user branch:', error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب فرع المستخدم",
      error: error.message
    });
  }
};

export const updateBranchBalance = async (req, res) => {
  try {
    const { balance } = req.body;
    
    // البحث والتحديث بالكود
    const branch = await Branch.findOneAndUpdate(
      { code: req.params.code },
      { cash_balance: balance },
      { new: true }
    ).select('-__v');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "الفرع غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم تحديث الرصيد",
      data: branch
    });
  } catch (error) {
    console.error('Error updating branch balance:', error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث الرصيد",
      error: error.message
    });
  }
};

// إنشاء فرع جديد
export const createBranch = async (req, res) => {
  try {
    const { name, code, type, cash_balance = 0 } = req.body;
    
    const existingBranch = await Branch.findOne({ 
      $or: [{ name }, { code }] 
    });
    
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: "اسم الفرع أو الكود موجود مسبقاً"
      });
    }

    const branch = new Branch({
      name,
      code,
      type,
      cash_balance
    });

    await branch.save();

    res.status(201).json({
      success: true,
      message: "تم إنشاء الفرع بنجاح",
      data: branch
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({
      success: false,
      message: "خطأ في إنشاء الفرع",
      error: error.message
    });
  }
};