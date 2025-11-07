import mongoose from "mongoose";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { generateInvoiceNo } from "../../utils/generateInvoiceNo.js";
import { success, error } from "../../utils/responses.js";

export async function createSale(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branch, items, customer, paymentMethod, exchangedScrap } = req.body;
    let total = 0;

    for (const it of items) {
      const price = Number(it.pricePerGram || 0);
      const weight = Number(it.weight || 0);
      const making = Number(it.makingCost || 0);
      it.subtotal = (price * weight) + making;
      total += it.subtotal;
    }

    if (exchangedScrap && exchangedScrap.total) {
      total -= Number(exchangedScrap.total);
    }

    const invoiceNo = generateInvoiceNo();
    const sale = await Sale.create([{
      invoiceNo, branch, items, customer,
      total,
      paymentMethod,
      exchangedScrap,
      createdBy: req.user._id
    }], { session });

    for (const it of items) {
      if (it.product) {
        const prod = await Product.findById(it.product).session(session);
        if (prod) {
          prod.count_in_showcase = prod.count_in_showcase - (it.quantity || 1);
          await prod.save({ session });
          await StockMovement.create([{
            product: prod._id,
            type: "sold",
            from: "showcase",
            to: "customer",
            quantity: it.quantity || 1,
            performedByEmployeeName: req.user.name,
            recordedBy: req.user._id
          }], { session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return success(res, sale[0], "تم إنشاء الفاتورة", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return error(res, "فشل إنشاء الفاتورة", 500, err.message);
  }
}

export async function listSales(req, res) {
  const items = await Sale.find().populate("createdBy").sort({ createdAt: -1 });
  return success(res, items, "قائمة الفواتير");
}
