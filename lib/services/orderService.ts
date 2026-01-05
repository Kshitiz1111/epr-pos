// Order Service - Business logic for online order operations
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
import { Order, OrderStatus } from "@/lib/types";
import { LoyaltyService } from "./loyaltyService";
import { LedgerService } from "./ledgerService";

export class OrderService {
  /**
   * Generate unique order number
   */
  static generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create a new order
   */
  static async createOrder(
    orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">
  ): Promise<{ orderId: string; orderNumber: string }> {
    try {
      const orderNumber = this.generateOrderNumber();
      const now = Timestamp.now();

      // Calculate loyalty points if customer is signed in
      let loyaltyPointsEarned = 0;
      const loyaltyPointsUsed = orderData.loyaltyPointsUsed || 0;

      if (orderData.customerId) {
        const rules = await LoyaltyService.getLoyaltyRules();
        if (rules) {
          // Calculate points earned
          loyaltyPointsEarned = LoyaltyService.calculateEarnedPoints(
            orderData.total,
            rules.earnRate
          );

          // Update customer loyalty points
          if (loyaltyPointsEarned > 0 || loyaltyPointsUsed > 0) {
            await LoyaltyService.updateCustomerPoints(
              orderData.customerId,
              loyaltyPointsEarned - loyaltyPointsUsed
            );
          }
        }
      }

      // Build order document, excluding undefined fields
      type OrderDocument = {
        orderNumber: string;
        customerInfo: Order["customerInfo"];
        items: Order["items"];
        subtotal: number;
        discount: number;
        total: number;
        paymentMethod: Order["paymentMethod"];
        status: OrderStatus;
        loyaltyPointsEarned: number;
        loyaltyPointsUsed: number;
        createdAt: Timestamp;
        updatedAt: Timestamp;
        customerId?: string;
        notes?: string;
      };

      const orderDoc: OrderDocument = {
        orderNumber,
        customerInfo: orderData.customerInfo,
        items: orderData.items,
        subtotal: orderData.subtotal,
        discount: orderData.discount,
        total: orderData.total,
        paymentMethod: orderData.paymentMethod,
        status: orderData.status,
        loyaltyPointsEarned,
        loyaltyPointsUsed,
        createdAt: now,
        updatedAt: now,
      };

      // Only include customerId if it's defined (not a guest order)
      if (orderData.customerId) {
        orderDoc.customerId = orderData.customerId;
      }

      // Only include optional fields if they're defined
      if (orderData.notes) {
        orderDoc.notes = orderData.notes;
      }

      const orderRef = await addDoc(collection(db, "orders"), orderDoc);

      // Create ledger entry for order (income when confirmed)
      // We'll create it when order is confirmed, not on creation

      return { orderId: orderRef.id, orderNumber };
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  /**
   * Get order by order number
   */
  static async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const q = query(collection(db, "orders"), where("orderNumber", "==", orderNumber));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Order;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  static async getOrder(orderId: string): Promise<Order | null> {
    try {
      const orderDoc = await getDoc(doc(db, "orders", orderId));
      if (!orderDoc.exists()) {
        return null;
      }
      return { id: orderDoc.id, ...orderDoc.data() } as Order;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  }

  /**
   * Get all orders with optional filters
   */
  static async getAllOrders(filters?: {
    status?: OrderStatus;
    startDate?: Date;
    endDate?: Date;
    customerId?: string;
  }): Promise<Order[]> {
    try {
      let q = query(collection(db, "orders"));

      // Try with orderBy first, but handle missing index gracefully
      try {
        q = query(q, orderBy("createdAt", "desc"));
      } catch {
        console.warn("Could not apply orderBy, will sort in memory");
      }

      if (filters?.status) {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters?.customerId) {
        q = query(q, where("customerId", "==", filters.customerId));
      }

      const querySnapshot = await getDocs(q);
      const orders: Order[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const order = { id: doc.id, ...data } as Order;

        // Apply date filters in memory if needed (Firestore has limitations)
        if (filters?.startDate || filters?.endDate) {
          const orderDate = order.createdAt.toDate();
          if (filters?.startDate && orderDate < filters.startDate) {
            return;
          }
          if (filters?.endDate && orderDate > filters.endDate) {
            return;
          }
        }

        orders.push(order);
      });

      // Sort by createdAt desc if orderBy wasn't applied
      if (!filters?.status && !filters?.customerId) {
        orders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
      }

      return orders;
    } catch (error: unknown) {
      // If query fails due to missing index, try without orderBy
      const err = error as { code?: string; message?: string };
      if (err.code === "failed-precondition" || err.message?.includes("index")) {
        console.warn("Composite index missing, fetching without orderBy");
        try {
          let q = query(collection(db, "orders"));
          
          if (filters?.status) {
            q = query(q, where("status", "==", filters.status));
          }

          if (filters?.customerId) {
            q = query(q, where("customerId", "==", filters.customerId));
          }

          const querySnapshot = await getDocs(q);
          const orders: Order[] = [];

          querySnapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data() } as Order;

            if (filters?.startDate || filters?.endDate) {
              const orderDate = order.createdAt.toDate();
              if (filters?.startDate && orderDate < filters.startDate) {
                return;
              }
              if (filters?.endDate && orderDate > filters.endDate) {
                return;
              }
            }

            orders.push(order);
          });

          // Sort in memory
          orders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          return orders;
        } catch (fallbackError) {
          console.error("Error fetching orders (fallback):", fallbackError);
          throw fallbackError;
        }
      }
      console.error("Error fetching orders:", error);
      throw error as Error;
    }
  }

  /**
   * Get orders for a specific customer
   */
  static async getCustomerOrders(customerId: string): Promise<Order[]> {
    return this.getAllOrders({ customerId });
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    performedBy?: string
  ): Promise<void> {
    try {
      type OrderUpdateData = {
        status: OrderStatus;
        updatedAt: Timestamp;
        confirmedAt?: Timestamp;
        shippedAt?: Timestamp;
        cancelledAt?: Timestamp;
        completedAt?: Timestamp;
        processedBy?: string;
      };

      const updateData: OrderUpdateData = {
        status,
        updatedAt: Timestamp.now(),
      };

      // Set timestamp based on status
      if (status === "CONFIRMED") {
        updateData.confirmedAt = Timestamp.now();
        // Create ledger entry when order is confirmed
        const order = await this.getOrder(orderId);
        if (order) {
          // Map Order paymentMethod to Ledger PaymentMethod
          // Order uses "COD" but Ledger uses "CASH"
          const ledgerPaymentMethod: "CASH" | "BANK_TRANSFER" | "FONE_PAY" | "CREDIT" = 
            order.paymentMethod === "COD" ? "CASH" : order.paymentMethod;
          
          await LedgerService.postSaleIncome(
            orderId,
            order.total,
            ledgerPaymentMethod,
            performedBy || "system"
          );
        }
      } else if (status === "SHIPPED") {
        updateData.shippedAt = Timestamp.now();
      } else if (status === "COMPLETED") {
        updateData.completedAt = Timestamp.now();
      } else if (status === "CANCELLED") {
        updateData.cancelledAt = Timestamp.now();
        // If order was confirmed, we might want to reverse the ledger entry
        // For now, we'll leave it as is (cancelled orders still show in ledger)
      }

      await updateDoc(doc(db, "orders", orderId), updateData);
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  /**
   * Update order notes
   */
  static async updateOrderNotes(orderId: string, notes: string): Promise<void> {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        notes,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating order notes:", error);
      throw error;
    }
  }

  /**
   * Get pending orders count (for badge)
   */
  static async getPendingOrdersCount(): Promise<number> {
    try {
      const q = query(
        collection(db, "orders"),
        where("status", "==", "PENDING")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error("Error fetching pending orders count:", error);
      return 0;
    }
  }
}

