// src/services/scrap.service.js
import ScrapStore from "../models/ScrapStore.js";
import ScrapTransaction from "../models/ScrapTransaction.js";

export class ScrapService {
  
  /**
   * إضافة سكراب من فاتورة بيع - يضاف لفرع البيع
   */
  static async addScrapFromSale(session, sale, userId) {
    try {
      const { exchangedScrap, invoiceNo, branch, createdBy } = sale;
      
      if (!exchangedScrap || exchangedScrap.length === 0) {
        return;
      }

      for (const scrapItem of exchangedScrap) {
        const { karat, weight } = scrapItem;
        
        if (!karat || !weight) continue;

        // إضافة السكراب لفرع البيع (floor1 أو floor2)
        await this.addToScrapStore(session, branch, karat, weight);
        
        // تسجيل حركة الإضافة
        await ScrapTransaction.create([{
          type: "add_from_invoice",
          branchTo: branch, // ← يضاف للفرع اللي حصلت فيه البيع
          karat,
          grams: weight,
          performedBy: sale.createdBy?.name || "System",
          recordedBy: userId || createdBy,
          invoiceNumber: invoiceNo,
          source: "sale_exchange",
          notes: `سكراب من فاتورة ${invoiceNo}`
        }], { session });
      }
    } catch (error) {
      console.error('Error adding scrap from sale:', error);
      throw error;
    }
  }

  /**
   * تحويل سكراب بين الفروع
   */
  static async transferScrapBetweenBranches(session, fromBranch, toBranch, karat, grams, userId, notes = "") {
    try {
      // خصم من الفرع المصدر
      await this.removeFromScrapStore(session, fromBranch, karat, grams);
      
      // إضافة للفرع الهدف
      await this.addToScrapStore(session, toBranch, karat, grams);

      // تسجيل حركة التحويل
      await ScrapTransaction.create([{
        type: "move_between_stores",
        branchFrom: fromBranch,
        branchTo: toBranch,
        karat,
        grams,
        performedBy: "System",
        recordedBy: userId,
        notes: notes || `تحويل سكراب من ${fromBranch} إلى ${toBranch}`
      }], { session });

    } catch (error) {
      console.error('Error transferring scrap:', error);
      throw error;
    }
  }

  /**
   * تحويل كل سكراب فرع للمخزن (نهاية اليوم)
   */
  static async transferAllScrapToWarehouse(session, fromBranch, toBranch = "warehouse", userId) {
    try {
      const store = await ScrapStore.findOne({ branch: fromBranch }).session(session);
      
      if (!store || store.totals.length === 0) {
        return { message: "لا يوجد سكراب للتحويل" };
      }

      const transfers = [];
      
      for (const item of store.totals) {
        const karat = item.karat;
        const grams = Number(item.grams.toString());
        
        if (grams > 0) {
          // تحويل كل العيار
          await this.transferScrapBetweenBranches(
            session, 
            fromBranch, 
            toBranch, 
            karat, 
            grams, 
            userId,
            `تحويل نهاية اليوم من ${fromBranch}`
          );
          
          transfers.push({ karat, grams });
        }
      }

      return { 
        message: `تم تحويل ${transfers.length} نوع سكراب من ${fromBranch} إلى ${toBranch}`,
        transfers 
      };

    } catch (error) {
      console.error('Error in daily transfer:', error);
      throw error;
    }
  }

  // الدوال المساعدة (نفسها)
  static async addToScrapStore(session, branch, karat, grams) {
    const store = await ScrapStore.findOne({ branch }).session(session);
    
    if (!store) {
      const newStore = new ScrapStore({ branch, totals: [{ karat, grams }] });
      await newStore.save({ session });
      return newStore;
    }
    
    const existingKarat = store.totals.find(t => t.karat === karat);
    
    if (existingKarat) {
      const currentGrams = Number(existingKarat.grams.toString());
      existingKarat.grams = currentGrams + Number(grams);
    } else {
      store.totals.push({ karat, grams });
    }
    
    await store.save({ session });
    return store;
  }

  static async removeFromScrapStore(session, branch, karat, grams) {
    const store = await ScrapStore.findOne({ branch }).session(session);
    
    if (!store) throw new Error(`مخزن السكراب للفرع ${branch} غير موجود`);
    
    const existingKarat = store.totals.find(t => t.karat === karat);
    
    if (!existingKarat) {
      throw new Error(`لا يوجد رصيد للعيار ${karat} في الفرع ${branch}`);
    }
    
    const currentGrams = Number(existingKarat.grams.toString());
    const removeGrams = Number(grams);
    
    if (currentGrams < removeGrams) {
      throw new Error(`الرصيد غير كافٍ للعيار ${karat}. المتاح: ${currentGrams}، المطلوب: ${removeGrams}`);
    }
    
    existingKarat.grams = currentGrams - removeGrams;
    
    if (existingKarat.grams <= 0) {
      store.totals = store.totals.filter(t => t.karat !== karat);
    }
    
    await store.save({ session });
    return store;
  }
}