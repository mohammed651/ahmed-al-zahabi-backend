import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { success, error } from "../../utils/responses.js";

export async function createProduct(req, res) {
  try {
    const data = req.body;
    const p = await Product.create(data);
    return success(res, p, "تم إنشاء المنتج", 201);
  } catch (err) {
    if (err.code === 11000) {
      return error(res, "كود المنتج موجود مسبقاً", 400);
    }
    return error(res, err.message, 400);
  }
}

export async function listProducts(req, res) {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    const filter = q ? { name: new RegExp(q, "i") } : {};
    
    const products = await Product.find(filter)
      .skip((page-1)*limit)
      .limit(Number(limit))
      .lean() // استخدام lean() علشان ناخد data نظيفة
      .exec();

    // تحويل الـ _id لـ string يدوياً
    const transformedProducts = products.map(product => ({
      ...product,
      id: product._id.toString(), // إضافة id كـ string
      _id: product._id.toString() // تحويل _id لـ string
    }));

    return success(res, transformedProducts, "قائمة المنتجات");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function getProduct(req, res) {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return error(res, "المنتج غير موجود", 404);
    return success(res, p, "المنتج");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    console.log('Update request - ID:', id, 'Data:', data);
    
    // البحث عن المنتج بالـ ID
    const product = await Product.findById(id);
    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }
    
    // تحديث البيانات
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && key !== 'id' && key !== '_id') {
        product[key] = data[key];
      }
    });
    
    await product.save();
    return success(res, product, "تم تحديث المنتج");
  } catch (err) {
    console.error('Update error:', err);
    if (err.code === 11000) {
      return error(res, "كود المنتج موجود مسبقاً", 400);
    }
    return error(res, err.message, 400);
  }
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    console.log('Delete request - ID:', id);
    
    const product = await Product.findById(id);
    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }
    
    await Product.findByIdAndDelete(id);
    return success(res, null, "تم حذف المنتج");
  } catch (err) {
    console.error('Delete error:', err);
    return error(res, err.message, 400);
  }
}
export async function moveStockSimple(req, res) {
  try {
    const { productCode, productId, type, from, to, quantity, performedByEmployeeName } = req.body;
    
    console.log('Move stock simple request:', req.body);

    // تحقق من الكمية وأنها رقم موجب
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return error(res, "الكمية يجب أن تكون رقماً موجباً أكبر من صفر", 400);
    }

    // البحث عن المنتج إما بالـ code أو الـ ID
    let product;
    if (productCode) {
      product = await Product.findOne({ code: productCode });
    } else if (productId) {
      product = await Product.findById(productId);
    } else {
      return error(res, "يجب تقديم productCode أو productId", 400);
    }

    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }

    // تطبيق حركة المخزون مع تحقق من عدم الوصول لأرقام سالبة
    if (type === "in") {
      if (to === "store") {
        product.count_in_store = (product.count_in_store || 0) + qty;
      } else if (to === "showcase") {
        product.count_in_showcase = (product.count_in_showcase || 0) + qty;
      } else {
        return error(res, "حقل 'to' غير صالح. استخدم 'store' أو 'showcase'", 400);
      }
    } else if (type === "out") {
      if (from === "store") {
        if ((product.count_in_store || 0) < qty) {
          return error(res, "الكمية غير متاحة في المستودع", 400);
        }
        product.count_in_store -= qty;
      } else if (from === "showcase") {
        if ((product.count_in_showcase || 0) < qty) {
          return error(res, "الكمية غير متاحة في الواجهة", 400);
        }
        product.count_in_showcase -= qty;
      } else {
        return error(res, "حقل 'from' غير صالح. استخدم 'store' أو 'showcase'", 400);
      }
    } else if (type === "transfer") {
      if (!from || !to) {
        return error(res, "يجب تقديم 'from' و 'to' لعملية النقل", 400);
      }
      if (from === to) {
        return error(res, "القيمة 'from' و 'to' يجب أن تكونا مختلفتين", 400);
      }

      if (from === "store" && to === "showcase") {
        if ((product.count_in_store || 0) < qty) {
          return error(res, "الكمية غير متاحة في المستودع", 400);
        }
        product.count_in_store -= qty;
        product.count_in_showcase = (product.count_in_showcase || 0) + qty;
      } else if (from === "showcase" && to === "store") {
        if ((product.count_in_showcase || 0) < qty) {
          return error(res, "الكمية غير متاحة في الواجهة", 400);
        }
        product.count_in_showcase -= qty;
        product.count_in_store = (product.count_in_store || 0) + qty;
      } else {
        return error(res, "قيم 'from'/'to' غير صالحة. استخدم 'store' أو 'showcase'", 400);
      }
    } else {
      return error(res, "نوع الحركة غير صالح. استخدم 'in' أو 'out' أو 'transfer'", 400);
    }

    await product.save();

    // تسجيل الحركة
    const mv = await StockMovement.create({
      product: product._id,
      type, from, to, quantity: qty,
      performedByEmployeeName: performedByEmployeeName || "النظام"
    });

    return success(res, { 
      product: product.toJSON(), 
      movement: mv.toJSON()
    }, "تم تسجيل حركة المخزون بنجاح");
    
  } catch (err) {
    console.error('Move stock simple error:', err);
    return error(res, err.message, 400);
  }
}

export async function moveStock(req, res) {
  try {
    const { productId, type, from, to, quantity, performedByEmployeeName } = req.body;
    
    console.log('Move stock request:', req.body);
    console.log('User:', req.user); // للتdebug

    // تحقق من الكمية وأنها رقم موجب
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return error(res, "الكمية يجب أن تكون رقماً موجباً أكبر من صفر", 400);
    }

    // البحث عن المنتج بالـ ID
    const product = await Product.findById(productId);
    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }

    // تطبيق حركة المخزون مع تحقق من عدم الوصول لأرقام سالبة
    if (type === "in") {
      if (to === "store") {
        product.count_in_store = (product.count_in_store || 0) + qty;
      } else if (to === "showcase") {
        product.count_in_showcase = (product.count_in_showcase || 0) + qty;
      } else {
        return error(res, "حقل 'to' غير صالح. استخدم 'store' أو 'showcase'", 400);
      }
    } else if (type === "out") {
      if (from === "store") {
        if ((product.count_in_store || 0) < qty) {
          return error(res, "الكمية غير متاحة في المستودع", 400);
        }
        product.count_in_store -= qty;
      } else if (from === "showcase") {
        if ((product.count_in_showcase || 0) < qty) {
          return error(res, "الكمية غير متاحة في الواجهة", 400);
        }
        product.count_in_showcase -= qty;
      } else {
        return error(res, "حقل 'from' غير صالح. استخدم 'store' أو 'showcase'", 400);
      }
    } else if (type === "transfer") {
      if (!from || !to) {
        return error(res, "يجب تقديم 'from' و 'to' لعملية النقل", 400);
      }
      if (from === to) {
        return error(res, "القيمة 'from' و 'to' يجب أن تكونا مختلفتين", 400);
      }

      if (from === "store" && to === "showcase") {
        if ((product.count_in_store || 0) < qty) {
          return error(res, "الكمية غير متاحة في المستودع", 400);
        }
        product.count_in_store -= qty;
        product.count_in_showcase = (product.count_in_showcase || 0) + qty;
      } else if (from === "showcase" && to === "store") {
        if ((product.count_in_showcase || 0) < qty) {
          return error(res, "الكمية غير متاحة في الواجهة", 400);
        }
        product.count_in_showcase -= qty;
        product.count_in_store = (product.count_in_store || 0) + qty;
      } else {
        return error(res, "قيم 'from'/'to' غير صالحة. استخدم 'store' أو 'showcase'", 400);
      }
    } else {
      return error(res, "نوع الحركة غير صالح. استخدم 'in' أو 'out' أو 'transfer'", 400);
    }

    await product.save();

    // تسجيل حركة المخزون - بدون user إذا مش موجود
    const mv = await StockMovement.create({
      product: product._id,
      type, 
      from, 
      to, 
      quantity: qty,
      performedByEmployeeName: performedByEmployeeName || "النظام",
      recordedBy: req.user ? req.user._id : null // تحقق من وجود user
    });

    return success(res, { 
      product: product, 
      movement: mv 
    }, "تم تسجيل حركة المخزون بنجاح");
    
  } catch (err) {
    console.error('Move stock error:', err);
    return error(res, err.message, 400);
  }
}

// دالة جديدة للبحث بالـ code
export async function getProductByCode(req, res) {
  try {
    const { code } = req.params;
    const product = await Product.findOne({ code });
    if (!product) return error(res, "المنتج غير موجود", 404);
    return success(res, product, "المنتج");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

// دالة جديدة للتحديث بالـ code
export async function updateProductByCode(req, res) {
  try {
    const { code } = req.params;
    const data = req.body;
    
    console.log('Update by code request - Code:', code, 'Data:', data);
    
    const product = await Product.findOne({ code });
    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }
    
    // تحديث البيانات
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && key !== 'id' && key !== '_id' && key !== 'code') {
        product[key] = data[key];
      }
    });
    
    await product.save();
    return success(res, product, "تم تحديث المنتج");
  } catch (err) {
    console.error('Update by code error:', err);
    if (err.code === 11000) {
      return error(res, "كود المنتج موجود مسبقاً", 400);
    }
    return error(res, err.message, 400);
  }
}

// دالة جديدة للحذف بالـ code
export async function deleteProductByCode(req, res) {
  try {
    const { code } = req.params;
    console.log('Delete by code request - Code:', code);
    
    const product = await Product.findOne({ code });
    if (!product) {
      return error(res, "المنتج غير موجود", 404);
    }
    
    await Product.findByIdAndDelete(product._id);
    return success(res, null, "تم حذف المنتج");
  } catch (err) {
    console.error('Delete by code error:', err);
    return error(res, err.message, 400);
  }
}