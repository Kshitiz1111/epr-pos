// Credit Service - Business logic for customer credit operations
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditTransaction, Customer } from "@/lib/types";
import { LedgerService } from "./ledgerService";

export class CreditService {
  /**
   * Create a credit transaction from a sale
   */
  static async createCreditTransaction(
    customerId: string,
    saleId: string,
    items: CreditTransaction["items"],
    totalAmount: number,
    paidAmount: number
  ): Promise<string> {
    try {
      const dueAmount = totalAmount - paidAmount;

      const creditRef = await addDoc(collection(db, "credit_transactions"), {
        customerId,
        saleId,
        items,
        totalAmount,
        paidAmount,
        dueAmount,
        createdAt: Timestamp.now(),
        settlementHistory: [],
      });

      // Update customer total due (if customer document exists)
      const customerRef = doc(db, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const customer = customerDoc.data() as Customer;
        await updateDoc(customerRef, {
          totalDue: (customer.totalDue || 0) + dueAmount,
        });
      }

      return creditRef.id;
    } catch (error) {
      console.error("Error creating credit transaction:", error);
      throw error;
    }
  }

  /**
   * Settle a credit (partial or full payment)
   */
  static async settleCredit(
    creditId: string,
    amount: number,
    settledBy: string,
    notes?: string
  ): Promise<void> {
    try {
      const creditRef = doc(db, "credit_transactions", creditId);
      const creditDoc = await getDoc(creditRef);

      if (!creditDoc.exists()) {
        throw new Error("Credit transaction not found");
      }

      const credit = { id: creditDoc.id, ...creditDoc.data() } as CreditTransaction;

      if (amount > credit.dueAmount) {
        throw new Error("Settlement amount cannot exceed due amount");
      }

      const newPaidAmount = credit.paidAmount + amount;
      const newDueAmount = credit.dueAmount - amount;
      const isFullySettled = newDueAmount === 0;

      // Build settlement history entry - only include notes if defined
      const settlementEntry: any = {
        amount,
        date: Timestamp.now(),
        settledBy,
      };
      
      // Only add notes if it's defined (Firestore doesn't allow undefined)
      if (notes) {
        settlementEntry.notes = notes;
      }

      // Build update object - only include settledAt if fully settled
      const updateData: any = {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        settlementHistory: [
          ...(credit.settlementHistory || []),
          settlementEntry,
        ],
      };

      // Only add settledAt if fully settled (Firestore doesn't allow undefined)
      if (isFullySettled) {
        updateData.settledAt = Timestamp.now();
      }

      // Update credit transaction
      await updateDoc(creditRef, updateData);

      // Update customer total due
      const customerRef = doc(db, "customers", credit.customerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const customer = customerDoc.data() as Customer;
        await updateDoc(customerRef, {
          totalDue: Math.max(0, (customer.totalDue || 0) - amount),
        });
      }

      // Create ledger entry for the settlement (income)
      await LedgerService.createEntry({
        date: Timestamp.now(),
        type: "INCOME",
        category: "SALES",
        amount,
        description: `Credit settlement for sale #${credit.saleId}${notes ? ` - ${notes}` : ""}`,
        relatedId: credit.saleId,
        paymentMethod: "CASH", // Default, can be made configurable
        performedBy: settledBy,
      });
    } catch (error) {
      console.error("Error settling credit:", error);
      throw error;
    }
  }

  /**
   * Get all credits for a customer
   */
  static async getCustomerCredits(customerId: string): Promise<CreditTransaction[]> {
    try {
      const q = query(
        collection(db, "credit_transactions"),
        where("customerId", "==", customerId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const credits: CreditTransaction[] = [];
      querySnapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as CreditTransaction);
      });

      return credits;
    } catch (error) {
      console.error("Error fetching customer credits:", error);
      throw error;
    }
  }

  /**
   * Get all outstanding credits
   */
  static async getAllOutstandingCredits(): Promise<CreditTransaction[]> {
    try {
      const q = query(
        collection(db, "credit_transactions"),
        where("dueAmount", ">", 0),
        orderBy("dueAmount", "desc")
      );

      const querySnapshot = await getDocs(q);
      const credits: CreditTransaction[] = [];
      querySnapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as CreditTransaction);
      });

      return credits;
    } catch (error) {
      console.error("Error fetching outstanding credits:", error);
      throw error;
    }
  }

  /**
   * Get credit transaction by ID
   */
  static async getCreditTransaction(creditId: string): Promise<CreditTransaction | null> {
    try {
      const creditDoc = await getDoc(doc(db, "credit_transactions", creditId));
      if (creditDoc.exists()) {
        return { id: creditDoc.id, ...creditDoc.data() } as CreditTransaction;
      }
      return null;
    } catch (error) {
      console.error("Error fetching credit transaction:", error);
      throw error;
    }
  }
}

