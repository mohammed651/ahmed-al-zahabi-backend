import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { success, error } from "../../utils/responses.js";

export async function createProduct(req, res) {
  const data = req.body;
  const p = await Product.create(data);
  return success(res, p, "تم إنشاء المنتج", 201);
}

export async function listProducts(req, res) {
  const { q, page = 1, limit = 50 } = req.query;
  const filter = q ? { name: new RegExp(q, "i") } : {};
  const products = await Product.find(filter).skip((page-1)*limit).limit(Number(limit));
  return success(res, products, "قائمة المنتجات");
}

export async function getProduct(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) return error(res, "المنتج غير موجود", 404);
  return success(res, p, "المنتج");
}

export async function moveStock(req, res) {
  const { productId, type, from, to, quantity, performedByEmployeeName } = req.body;
  const prod = await Product.findById(productId);
  if (!prod) return error(res, "المنتج غير موجود", 404);

  if (type === "in") {
    if (to === "store") prod.count_in_store += quantity;
    if (to === "showcase") prod.count_in_showcase += quantity;
  } else if (type === "out") {
    if (from === "store") prod.count_in_store -= quantity;
    if (from === "showcase") prod.count_in_showcase -= quantity;
  } else if (type === "transfer") {
    if (from === "store" && to === "showcase") {
      prod.count_in_store -= quantity;
      prod.count_in_showcase += quantity;
    }
  } else if (type === "adjustment") {
    prod.count_in_store = typeof req.body.count_in_store !== "undefined" ? req.body.count_in_store : prod.count_in_store;
    prod.count_in_showcase = typeof req.body.count_in_showcase !== "undefined" ? req.body.count_in_showcase : prod.count_in_showcase;
  }

  await prod.save();

  const mv = await StockMovement.create({
    product: prod._id,
    type, from, to, quantity,
    performedByEmployeeName: performedByEmployeeName || req.user.name,
    recordedBy: req.user._id
  });

  return success(res, { product: prod, movement: mv }, "تم تسجيل حركة المخزون");
}
