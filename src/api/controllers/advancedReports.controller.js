// src/api/controllers/advancedReports.controller.js
import mongoose from "mongoose";
import Sale from "../../models/Sale.js";
import Purchase from "../../models/Purchase.js";
import Product from "../../models/Product.js";
import Supplier from "../../models/Supplier.js";
import ScrapTransaction from "../../models/ScrapTransaction.js";
import Return from "../../models/Return.js";
import { success, error } from "../../utils/responses.js";

// تقرير الأرباح والخسائر
export async function getProfitLossReport(req, res) {
  try {
    const { startDate, endDate, branch } = req.query;
    
    let saleFilter = { status: "completed" };
    let purchaseFilter = {};
    
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      
      saleFilter.createdAt = dateFilter;
      purchaseFilter.createdAt = dateFilter;
    }
    
    if (branch) {
      saleFilter.branch = branch;
      purchaseFilter.branch = branch;
    }

    // إجمالي المبيعات
    const sales = await Sale.find(saleFilter);
    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total?.toString() || 0), 0);
    
    // إجمالي المشتريات
    const purchases = await Purchase.find(purchaseFilter);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.total?.toString() || 0), 0);
    
    // إجمالي المرتجعات
    const returns = await Return.find({ 
      status: "completed", 
      createdAt: saleFilter.createdAt,
      branch: saleFilter.branch 
    });
    const totalReturns = returns.reduce((sum, ret) => sum + Number(ret.netRefundAmount?.toString() || 0), 0);
    
    // إجمالي الكسر المباع
    const scrapSales = await ScrapTransaction.find({
      type: "sell_to_trader",
      createdAt: saleFilter.createdAt,
      branchFrom: branch
    });
    const totalScrapSales = scrapSales.reduce((sum, scrap) => sum + Number(scrap.value?.toString() || 0), 0);

    // حساب صافي الربح
    const grossProfit = totalSales + totalScrapSales - totalPurchases - totalReturns;
    const netProfit = grossProfit; // يمكن إضافة المصروفات هنا لاحقاً

    const report = {
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'النهاية',
        branch: branch || 'جميع الفروع'
      },
      revenue: {
        totalSales,
        totalScrapSales,
        totalRevenue: totalSales + totalScrapSales
      },
      costs: {
        totalPurchases,
        totalReturns,
        totalCosts: totalPurchases + totalReturns
      },
      profit: {
        grossProfit,
        netProfit,
        profitMargin: totalSales > 0 ? (netProfit / totalSales) * 100 : 0
      },
      statistics: {
        totalInvoices: sales.length,
        totalReturns: returns.length,
        totalPurchases: purchases.length
      }
    };

    return success(res, report, "تقرير الأرباح والخسائر");
  } catch (err) {
    console.error('Profit loss report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// تقرير تحليل المبيعات
export async function getSalesAnalysisReport(req, res) {
  try {
    const { startDate, endDate, branch, groupBy = "daily" } = req.query;
    
    let filter = { status: "completed" };
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (branch) filter.branch = branch;

    const sales = await Sale.find(filter)
      .populate("items.product")
      .sort({ createdAt: 1 });

    // تحليل حسب الفترة
    let analysis = {};
    
    sales.forEach(sale => {
      let key;
      const date = new Date(sale.createdAt);
      
      if (groupBy === "daily") {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (groupBy === "monthly") {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (groupBy === "yearly") {
        key = date.getFullYear().toString();
      }
      
      if (!analysis[key]) {
        analysis[key] = {
          period: key,
          totalSales: 0,
          totalInvoices: 0,
          averageSale: 0,
          productsSold: 0
        };
      }
      
      analysis[key].totalSales += Number(sale.total?.toString() || 0);
      analysis[key].totalInvoices += 1;
      analysis[key].productsSold += sale.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    });

    // حساب المتوسطات
    Object.keys(analysis).forEach(key => {
      analysis[key].averageSale = analysis[key].totalSales / analysis[key].totalInvoices;
    });

    // تحليل المنتجات
    const productAnalysis = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.product?._id?.toString() || item.productName;
        if (!productAnalysis[productId]) {
          productAnalysis[productId] = {
            productName: item.productName,
            totalSold: 0,
            totalRevenue: 0,
            quantity: 0
          };
        }
        
        productAnalysis[productId].quantity += item.quantity || 1;
        productAnalysis[productId].totalRevenue += Number(item.subtotal?.toString() || 0);
        productAnalysis[productId].totalSold += 1;
      });
    });

    const report = {
      periodAnalysis: Object.values(analysis),
      productAnalysis: Object.values(productAnalysis),
      summary: {
        totalPeriods: Object.keys(analysis).length,
        totalProducts: Object.keys(productAnalysis).length,
        bestSellingProduct: Object.values(productAnalysis).sort((a, b) => b.quantity - a.quantity)[0],
        highestRevenueProduct: Object.values(productAnalysis).sort((a, b) => b.totalRevenue - a.totalRevenue)[0]
      }
    };

    return success(res, report, "تقرير تحليل المبيعات");
  } catch (err) {
    console.error('Sales analysis report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// تقرير تحليل المخزون
export async function getInventoryAnalysisReport(req, res) {
  try {
    const products = await Product.find({})
      .sort({ count_in_showcase: -1 });

    const inventoryValue = products.reduce((sum, product) => {
      const weight = Number(product.weight?.toString() || 0);
      const price = Number(product.pricePerGram?.toString() || 0);
      const quantity = (product.count_in_store || 0) + (product.count_in_showcase || 0);
      return sum + (weight * price * quantity);
    }, 0);

    // تحليل المنتجات الراكدة (لم تتحرك منذ 30 يوم)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const slowMovingProducts = products.filter(product => {
      // يمكن إضافة منطق أكثر تطوراً هنا
      return (product.count_in_showcase + product.count_in_store) > 5; // مثال
    });

    const lowStockProducts = products.filter(product => {
      return (product.count_in_showcase + product.count_in_store) <= 2;
    });

    const report = {
      summary: {
        totalProducts: products.length,
        totalInventoryValue: inventoryValue,
        totalItems: products.reduce((sum, p) => sum + p.count_in_store + p.count_in_showcase, 0),
        averageStockValue: inventoryValue / products.length
      },
      analysis: {
        slowMovingProducts: slowMovingProducts.map(p => ({
          name: p.name,
          code: p.code,
          currentStock: p.count_in_store + p.count_in_showcase,
          value: Number(p.weight?.toString() || 0) * Number(p.pricePerGram?.toString() || 0)
        })),
        lowStockProducts: lowStockProducts.map(p => ({
          name: p.name,
          code: p.code,
          currentStock: p.count_in_store + p.count_in_showcase,
          reorderNeeded: true
        })),
        topProducts: products.slice(0, 10).map(p => ({
          name: p.name,
          code: p.code,
          stock: p.count_in_store + p.count_in_showcase,
          value: Number(p.weight?.toString() || 0) * Number(p.pricePerGram?.toString() || 0)
        }))
      }
    };

    return success(res, report, "تقرير تحليل المخزون");
  } catch (err) {
    console.error('Inventory analysis report error:', err);
    return error(res, "فشل في إنشاء التقرير", 500, err.message);
  }
}

// تقرير إحصاءات عامة
export async function getDashboardStats(req, res) {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // إحصائيات اليوم
    const todaySales = await Sale.find({
      createdAt: { $gte: startOfToday },
      status: "completed"
    });
    const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total?.toString() || 0), 0);
    
    // إحصائيات الشهر
    const monthSales = await Sale.find({
      createdAt: { $gte: startOfMonth },
      status: "completed"
    });
    const monthRevenue = monthSales.reduce((sum, sale) => sum + Number(sale.total?.toString() || 0), 0);
    
    // إحصائيات عامة
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await Sale.distinct("customer.phone").countDocuments();
    const totalSuppliers = await Supplier.countDocuments({ isActive: true });
    
    // المنتجات منخفضة المخزون
    const lowStockProducts = await Product.find({
      $expr: {
        $lte: [
          { $add: ["$count_in_store", "$count_in_showcase"] },
          2
        ]
      }
    }).countDocuments();

    const stats = {
      today: {
        sales: todaySales.length,
        revenue: todayRevenue
      },
      month: {
        sales: monthSales.length,
        revenue: monthRevenue
      },
      general: {
        totalProducts,
        totalCustomers,
        totalSuppliers,
        lowStockProducts
      },
      recentActivity: {
        latestSales: await Sale.find({ status: "completed" })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("createdBy", "name"),
        pendingReturns: await Return.find({ status: "pending" }).countDocuments()
      }
    };

    return success(res, stats, "إحصائيات لوحة التحكم");
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return error(res, "فشل في جلب الإحصائيات", 500, err.message);
  }
}