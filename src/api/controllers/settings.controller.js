// src/api/controllers/settings.controller.js
import Setting from "../../models/Setting.js";
import { success, error } from "../../utils/responses.js";

// الحصول على جميع الإعدادات
export async function getSettings(req, res) {
  try {
    const { category } = req.query;
    
    let filter = {};
    if (category) filter.category = category;
    
    const settings = await Setting.find(filter);
    
    // تحويل الإعدادات لكائن عادي
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });
    
    return success(res, settingsObject, "الإعدادات");
  } catch (err) {
    console.error('Get settings error:', err);
    return error(res, "فشل في جلب الإعدادات", 500, err.message);
  }
}

// تحديث إعدادات
export async function updateSettings(req, res) {
  try {
    const { settings } = req.body;
    
    const updates = Object.keys(settings).map(key => ({
      updateOne: {
        filter: { key },
        update: { 
          $set: { 
            value: settings[key],
            updatedAt: new Date()
          } 
        },
        upsert: true
      }
    }));
    
    await Setting.bulkWrite(updates);
    
    return success(res, settings, "تم تحديث الإعدادات بنجاح");
  } catch (err) {
    console.error('Update settings error:', err);
    return error(res, "فشل في تحديث الإعدادات", 500, err.message);
  }
}

// الإعدادات الافتراضية
export async function initializeDefaultSettings(req, res) {
  try {
    const defaultSettings = [
      // إعدادات عامة
      { key: "app_name", value: "أحمد الزهابي للمجوهرات", type: "string", category: "general", description: "اسم التطبيق" },
      { key: "currency", value: "EGP", type: "string", category: "general", description: "العملة" },
      
      // إعدادات المخزون
      { key: "low_stock_alert", value: 2, type: "number", category: "inventory", description: "تنبيه المخزون المنخفض" },
      { key: "auto_backup", value: true, type: "boolean", category: "inventory", description: "نسخ احتياطي تلقائي" },
      
      // إعدادات الفواتير
      { key: "invoice_prefix", value: "INV", type: "string", category: "invoices", description: "بادئة أرقام الفواتير" },
      { key: "default_tax", value: 0, type: "number", category: "invoices", description: "الضريبة الافتراضية" },
      
      // إعدادات المبيعات
      { key: "round_to_nearest", value: 5, type: "number", category: "sales", description: "التقريب لأقرب" },
      { key: "default_payment_method", value: "cash", type: "string", category: "sales", description: "طريقة الدفع الافتراضية" }
    ];
    
    await Setting.insertMany(defaultSettings, { ordered: false });
    
    return success(res, null, "تم تهيئة الإعدادات الافتراضية");
  } catch (err) {
    console.error('Initialize settings error:', err);
    return error(res, "فشل في تهيئة الإعدادات", 500, err.message);
  }
}