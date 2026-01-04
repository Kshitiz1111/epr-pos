// Vendor Service - Business logic for vendor operations
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor, PurchaseOrder, PurchaseOrderItem } from "@/lib/types";
import { ProductService } from "./productService";

export class VendorService {
  /**
   * Create a new vendor
   */
  static async createVendor(vendorData: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const vendorRef = await addDoc(collection(db, "vendors"), {
        ...vendorData,
        balance: 0,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return vendorRef.id;
    } catch (error) {
      console.error("Error creating vendor:", error);
      throw error;
    }
  }

  /**
   * Update a vendor
   */
  static async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<void> {
    try {
      const vendorRef = doc(db, "vendors", vendorId);
      await updateDoc(vendorRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating vendor:", error);
      throw error;
    }
  }

  /**
   * Get all vendors
   */
  static async getAllVendors(): Promise<Vendor[]> {
    try {
      const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const vendors: Vendor[] = [];
      querySnapshot.forEach((doc) => {
        vendors.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      return vendors;
    } catch (error) {
      console.error("Error fetching vendors:", error);
      throw error;
    }
  }

  /**
   * Get vendor by ID
   */
  static async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const vendorDoc = await getDoc(doc(db, "vendors", vendorId));
      if (vendorDoc.exists()) {
        return { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;
      }
      return null;
    } catch (error) {
      console.error("Error fetching vendor:", error);
      throw error;
    }
  }

  /**
   * Create a purchase order
   */
  static async createPurchaseOrder(
    vendorId: string,
    items: PurchaseOrderItem[],
    createdBy: string
  ): Promise<string> {
    try {
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      const poRef = await addDoc(collection(db, "purchase_orders"), {
        vendorId,
        items,
        totalAmount,
        status: "PENDING",
        createdBy,
        createdAt: Timestamp.now(),
      });

      return poRef.id;
    } catch (error) {
      console.error("Error creating purchase order:", error);
      throw error;
    }
  }

  /**
   * Process GRN (Goods Received Note)
   */
  static async processGRN(
    poId: string,
    receivedItems: Array<{ productId: string; receivedQuantity: number; warehouseId: string }>,
    receivedBy: string
  ): Promise<void> {
    try {
      const poDoc = await getDoc(doc(db, "purchase_orders", poId));
      if (!poDoc.exists()) {
        throw new Error("Purchase order not found");
      }

      const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

      // Update purchase order status
      await updateDoc(doc(db, "purchase_orders", poId), {
        status: "RECEIVED",
        receivedAt: Timestamp.now(),
        receivedBy,
        items: po.items.map((item) => {
          const received = receivedItems.find((ri) => ri.productId === item.productId);
          return {
            ...item,
            receivedQuantity: received?.receivedQuantity || 0,
          };
        }),
      });

      // Update inventory for each received item
      for (const receivedItem of receivedItems) {
        const poItem = po.items.find((item) => item.productId === receivedItem.productId);
        if (poItem) {
          // Get current product warehouse data
          const product = await ProductService.getProduct(receivedItem.productId);
          if (product) {
            const currentQty = product.warehouses[receivedItem.warehouseId]?.quantity || 0;
            await ProductService.updateWarehouseQuantity(
              receivedItem.productId,
              receivedItem.warehouseId,
              currentQty + receivedItem.receivedQuantity
            );
          }
        }
      }

      // Update vendor balance (Accounts Payable)
      const vendor = await this.getVendor(po.vendorId);
      if (vendor) {
        await this.updateVendor(po.vendorId, {
          balance: vendor.balance + po.totalAmount,
        });
      }
    } catch (error) {
      console.error("Error processing GRN:", error);
      throw error;
    }
  }

  /**
   * Get all purchase orders
   */
  static async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
      const q = query(collection(db, "purchase_orders"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const orders: PurchaseOrder[] = [];
      querySnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
      });
      return orders;
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      throw error;
    }
  }
}

