// Core TypeScript types for the ERP/POS system
import { Timestamp } from "firebase/firestore";

// User & Authentication Types
export type UserRole = "admin" | "manager" | "staff" | "customer";

export type ResourcePermission = {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type EmployeePermissions = {
  resources: {
    inventory: ResourcePermission;
    finance: ResourcePermission;
    customers: ResourcePermission & {
      viewCredits: boolean;
      settleCredits: boolean;
    };
    employees: ResourcePermission;
    vendors: ResourcePermission;
    pos: ResourcePermission;
    reports: ResourcePermission;
    orders: ResourcePermission;
    settings: ResourcePermission;
  };
};

export type User = {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  role: UserRole;
  permissions?: EmployeePermissions;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
};

// Product & Inventory Types
export type Warehouse = {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
};

export type ProductWarehouse = {
  quantity: number;
  position: string; // e.g., "Row A - Shelf 2"
  minQuantity: number; // Low stock threshold
};

export type Product = {
  id: string;
  sku: string; // The text inside the QR Code
  name: string;
  description?: string;
  category: string;
  price: number;
  costPrice?: number; // For profit calculation
  discount?: number; // Discount percentage or amount
  imageUrl?: string;
  warehouses: {
    [warehouseId: string]: ProductWarehouse;
  };
  trackTrace: {
    qrCodeUrl: string; // Generated on creation
    history: Array<{
      action: string;
      from?: string;
      to?: string;
      performedBy: string;
      timestamp: Timestamp;
    }>;
  };
  attributes?: Record<string, string>; // e.g., { "wattage": "500W", "material": "steel" }
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// Customer Types
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  totalSpent: number;
  totalDue?: number; // Total outstanding credit
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// Credit Transaction Types
export type CreditTransactionItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  status: "PAID" | "CREDIT";
  paidAmount?: number;
};

export type CreditTransaction = {
  id: string;
  customerId: string;
  saleId: string;
  items: CreditTransactionItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: Timestamp;
  settledAt?: Timestamp;
  settlementHistory: Array<{
    amount: number;
    date: Timestamp;
    settledBy: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }>;
};

// Sale & POS Types
export type SaleItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  subtotal: number;
};

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "FONE_PAY" | "CREDIT" | "CHEQUE";

export type Sale = {
  id: string;
  customerId?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax?: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  isCredit: boolean;
  performedBy: string; // User ID
  createdAt: Timestamp;
};

// Finance & Ledger Types
export type LedgerEntryType = "INCOME" | "EXPENSE" | "ASSET" | "LIABILITY";
export type LedgerCategory =
  | "SALES"
  | "PURCHASE"
  | "SALARY"
  | "RENT"
  | "UTILITY"
  | "VENDOR_PAY"
  | "ADVANCE"
  | "COMMISSION"
  | "OTHER";

export type LedgerEntry = {
  id: string;
  date: Timestamp;
  type: LedgerEntryType;
  category: LedgerCategory;
  amount: number;
  description: string;
  relatedId?: string; // ID of the Order, Employee, or Vendor
  paymentMethod: PaymentMethod;
  performedBy: string; // User ID
  createdAt: Timestamp;
};

// Employee & HR Types
export type EmployeeProfile = {
  uid: string; // Linked to Firebase Auth
  role: UserRole;
  baseSalary: number;
  joiningDate: Timestamp;
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
  finance: {
    currentAdvance: number;
    unpaidCommissions: number;
  };
  permissions: EmployeePermissions;
};

export type AttendanceRecord = {
  id: string;
  uid: string;
  date: string; // "2024-05-20"
  checkIn: Timestamp;
  checkOut?: Timestamp;
  totalHours?: number;
  notes?: string;
};

// Vendor Types
export type Vendor = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string; // Vendor category (e.g., "Electronics", "Furniture", etc.)
  balance: number; // How much we owe them (Accounts Payable)
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PurchaseOrderStatus = "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";

export type PurchaseOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity?: number;
};

export type PurchaseOrder = {
  id: string;
  vendorId: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  createdBy: string;
  createdAt: Timestamp;
  receivedAt?: Timestamp;
  receivedBy?: string;
  billImageUrl?: string;
};

// Order Types
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "CANCELLED" | "COMPLETED";

export type OrderItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string;
};

export type Order = {
  id: string;
  orderNumber: string; // Unique order number for tracking
  customerId?: string; // null if guest order
  customerInfo: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number; // Loyalty discount
  total: number;
  paymentMethod: "COD" | "BANK_TRANSFER" | "FONE_PAY";
  status: OrderStatus;
  loyaltyPointsUsed?: number; // Points redeemed for this order
  loyaltyPointsEarned?: number; // Points earned from this order
  notes?: string; // Admin notes
  createdAt: Timestamp;
  updatedAt: Timestamp;
  confirmedAt?: Timestamp;
  shippedAt?: Timestamp;
  cancelledAt?: Timestamp;
};

// Loyalty Types
export type LoyaltyRules = {
  earnRate: number; // e.g., 0.001 means spend 1000, get 1 point
  redeemRate: number; // e.g., 10 means 1 point = 10 Rupees discount
  minPointsToRedeem: number;
  updatedAt: Timestamp;
};

// Printer Types
export type PrinterType = "USB" | "SERIAL" | "BLUETOOTH";
export type PrinterConnection = {
  type: PrinterType;
  port?: SerialPort;
  device?: BluetoothDevice;
  isConnected: boolean;
};

