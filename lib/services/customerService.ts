// Customer Service - Business logic for customer operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer, Sale } from "@/lib/types";

export class CustomerService {
  /**
   * Recalculate totalSpent for a customer from their sales
   */
  static async recalculateTotalSpent(customerId: string): Promise<number> {
    try {
      // Fetch all sales for this customer (without orderBy to avoid index requirement)
      const salesQuery = query(
        collection(db, "sales"),
        where("customerId", "==", customerId)
      );

      const querySnapshot = await getDocs(salesQuery);
      const sales: Sale[] = [];
      querySnapshot.forEach((doc) => {
        sales.push({ id: doc.id, ...doc.data() } as Sale);
      });

      // Calculate total from all sales
      const calculatedTotal = sales.reduce((sum, sale) => sum + sale.total, 0);

      // Update customer document
      const customerRef = doc(db, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      
      if (customerDoc.exists()) {
        await updateDoc(customerRef, {
          totalSpent: calculatedTotal,
        });
      }

      return calculatedTotal;
    } catch (error) {
      console.error("Error recalculating totalSpent:", error);
      throw error;
    }
  }

  /**
   * Get customer sales and calculate totalSpent
   */
  static async getCustomerSalesTotal(customerId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "sales"),
        where("customerId", "==", customerId)
      );
      
      const querySnapshot = await getDocs(q);
      let total = 0;
      
      querySnapshot.forEach((doc) => {
        const sale = doc.data() as Sale;
        total += sale.total;
      });

      return total;
    } catch (error) {
      console.error("Error calculating customer sales total:", error);
      return 0;
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customerDoc = await getDoc(doc(db, "customers", customerId));
      if (customerDoc.exists()) {
        return { id: customerDoc.id, ...customerDoc.data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error("Error fetching customer:", error);
      throw error;
    }
  }
}

