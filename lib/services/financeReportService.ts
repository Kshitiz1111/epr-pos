// Finance Report Service - Generate comprehensive financial reports
import { LedgerService } from "./ledgerService";
import { SaleService } from "./saleService";
import { OrderService } from "./orderService";
import { VendorService } from "./vendorService";
import { CreditService } from "./creditService";
import { LedgerEntry, Sale, Order } from "@/lib/types";

export interface PLStatement {
  income: number;
  expenses: number;
  netProfit: number;
  incomeBreakdown: {
    sales: number;
    orders: number;
    other: number;
  };
  expenseBreakdown: {
    purchases: number;
    vendorPayments: number;
    salaries: number;
    rent: number;
    utilities: number;
    other: number;
  };
}

export interface CashFlow {
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  cashInBreakdown: {
    cash: number;
    bankTransfer: number;
    fonePay: number;
  };
  cashOutBreakdown: {
    cash: number;
    bankTransfer: number;
    fonePay: number;
  };
}

export interface BalanceSheet {
  assets: {
    cash: number;
    inventory: number;
    receivables: number; // Customer credits
    total: number;
  };
  liabilities: {
    payables: number; // Vendor balances
    total: number;
  };
  equity: number; // Assets - Liabilities
}

export interface SalesReport {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  salesByProduct: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  salesByCategory: Record<string, number>;
  salesByCustomer: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    orderCount: number;
  }>;
}

export interface ExpenseReport {
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  topExpenses: Array<{
    description: string;
    amount: number;
    category: string;
    date: Date;
  }>;
}

export class FinanceReportService {
  /**
   * Generate P&L Statement for a date range
   */
  static async generatePLStatement(
    startDate: Date,
    endDate: Date
  ): Promise<PLStatement> {
    try {
      // Get actual POS sales and online orders directly (more accurate than ledger alone)
      const sales = await SaleService.getSales(startDate, endDate);
      const posSalesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const onlineOrdersRevenue = confirmedOrCompletedOrders.reduce((sum, order) => sum + order.total, 0);

      // Get expenses from ledger
      const entries = await LedgerService.getEntries(startDate, endDate);

      let expenses = 0;
      const incomeBreakdown = {
        sales: posSalesRevenue, // POS sales revenue
        orders: onlineOrdersRevenue, // Online orders revenue
        other: 0,
      };
      const expenseBreakdown = {
        purchases: 0,
        vendorPayments: 0,
        salaries: 0,
        rent: 0,
        utilities: 0,
        other: 0,
      };

      // Calculate expenses and other income from ledger
      entries.forEach((entry) => {
        if (entry.type === "INCOME") {
          // Only count other income (not sales, as we're using direct sales/orders data)
          if (entry.category !== "SALES") {
            incomeBreakdown.other += entry.amount;
          }
        } else if (entry.type === "EXPENSE") {
          expenses += entry.amount;
          switch (entry.category) {
            case "PURCHASE":
              expenseBreakdown.purchases += entry.amount;
              break;
            case "VENDOR_PAY":
              expenseBreakdown.vendorPayments += entry.amount;
              break;
            case "SALARY":
              expenseBreakdown.salaries += entry.amount;
              break;
            case "RENT":
              expenseBreakdown.rent += entry.amount;
              break;
            case "UTILITY":
              expenseBreakdown.utilities += entry.amount;
              break;
            default:
              expenseBreakdown.other += entry.amount;
          }
        }
      });

      // Total income = POS sales + Online orders + Other income
      const income = posSalesRevenue + onlineOrdersRevenue + incomeBreakdown.other;

      return {
        income,
        expenses,
        netProfit: income - expenses,
        incomeBreakdown,
        expenseBreakdown,
      };
    } catch (error) {
      console.error("Error generating P&L statement:", error);
      throw error;
    }
  }

  /**
   * Generate Cash Flow statement
   */
  static async generateCashFlow(
    startDate: Date,
    endDate: Date
  ): Promise<CashFlow> {
    try {
      // Get actual sales and orders for accurate cash flow
      const sales = await SaleService.getSales(startDate, endDate);
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );

      // Get expenses from ledger
      const entries = await LedgerService.getEntries(startDate, endDate);

      const cashInBreakdown = {
        cash: 0,
        bankTransfer: 0,
        fonePay: 0,
      };
      const cashOutBreakdown = {
        cash: 0,
        bankTransfer: 0,
        fonePay: 0,
      };

      // Process POS sales
      sales.forEach((sale) => {
        switch (sale.paymentMethod) {
          case "CASH":
            cashInBreakdown.cash += sale.total;
            break;
          case "BANK_TRANSFER":
            cashInBreakdown.bankTransfer += sale.total;
            break;
          case "FONE_PAY":
            cashInBreakdown.fonePay += sale.total;
            break;
        }
      });

      // Process online orders (map COD to CASH, others directly)
      confirmedOrCompletedOrders.forEach((order) => {
        const paymentMethod = order.paymentMethod === "COD" ? "CASH" : order.paymentMethod;
        switch (paymentMethod) {
          case "CASH":
            cashInBreakdown.cash += order.total;
            break;
          case "BANK_TRANSFER":
            cashInBreakdown.bankTransfer += order.total;
            break;
          case "FONE_PAY":
            cashInBreakdown.fonePay += order.total;
            break;
        }
      });

      // Process other income and expenses from ledger
      entries.forEach((entry) => {
        if (entry.type === "INCOME" && entry.category !== "SALES") {
          // Other income (not sales, as we've already processed sales/orders)
          switch (entry.paymentMethod) {
            case "CASH":
              cashInBreakdown.cash += entry.amount;
              break;
            case "BANK_TRANSFER":
              cashInBreakdown.bankTransfer += entry.amount;
              break;
            case "FONE_PAY":
              cashInBreakdown.fonePay += entry.amount;
              break;
          }
        } else if (entry.type === "EXPENSE") {
          switch (entry.paymentMethod) {
            case "CASH":
              cashOutBreakdown.cash += entry.amount;
              break;
            case "BANK_TRANSFER":
              cashOutBreakdown.bankTransfer += entry.amount;
              break;
            case "FONE_PAY":
              cashOutBreakdown.fonePay += entry.amount;
              break;
            case "CHEQUE":
              // Cheque is typically bank transfer
              cashOutBreakdown.bankTransfer += entry.amount;
              break;
          }
        }
      });

      const cashIn =
        cashInBreakdown.cash +
        cashInBreakdown.bankTransfer +
        cashInBreakdown.fonePay;
      const cashOut =
        cashOutBreakdown.cash +
        cashOutBreakdown.bankTransfer +
        cashOutBreakdown.fonePay;

      return {
        cashIn: cashIn || 0,
        cashOut: cashOut || 0,
        netCashFlow: (cashIn || 0) - (cashOut || 0),
        cashInBreakdown: cashInBreakdown || { cash: 0, bankTransfer: 0, fonePay: 0 },
        cashOutBreakdown: cashOutBreakdown || { cash: 0, bankTransfer: 0, fonePay: 0 },
      };
    } catch (error) {
      console.error("Error generating cash flow:", error);
      throw error;
    }
  }

  /**
   * Generate Balance Sheet
   */
  static async generateBalanceSheet(): Promise<BalanceSheet> {
    try {
      // Calculate receivables (outstanding customer credits)
      const outstandingCredits = await CreditService.getAllOutstandingCredits();
      const receivables = outstandingCredits.reduce(
        (sum, credit) => sum + (credit.dueAmount || 0),
        0
      );

      // Calculate payables (outstanding vendor balances)
      const vendors = await VendorService.getAllVendors();
      const payables = vendors.reduce(
        (sum, vendor) => sum + (vendor.balance > 0 ? vendor.balance : 0),
        0
      );

      // Calculate inventory value from products
      const { ProductService } = await import("./productService");
      const products = await ProductService.getAllProducts();
      let inventory = 0;
      products.forEach((product) => {
        if (product.costPrice) {
          Object.values(product.warehouses || {}).forEach((warehouse) => {
            inventory += (warehouse.quantity || 0) * (product.costPrice || 0);
          });
        }
      });

      // Calculate cash from actual sales and orders + ledger entries
      // Get all POS sales with CASH payment
      const allSales = await SaleService.getSales(new Date(0), new Date());
      let cashFromSales = 0;
      allSales.forEach((sale) => {
        if (sale.paymentMethod === "CASH") {
          cashFromSales += sale.total;
        }
      });

      // Get all confirmed/completed orders with COD (which is CASH)
      const allOrders = await OrderService.getAllOrders({});
      const allConfirmedOrders = allOrders.filter(
        (o) => (o.status === "CONFIRMED" || o.status === "COMPLETED") && o.paymentMethod === "COD"
      );
      const cashFromOrders = allConfirmedOrders.reduce((sum, order) => sum + order.total, 0);

      // Get cash from ledger (other income and expenses)
      const allEntries = await LedgerService.getEntries(
        new Date(0), // From beginning
        new Date() // To now
      );
      
      let cashFromLedger = 0;
      allEntries.forEach((entry) => {
        // Skip SALES category as we've already counted from actual sales/orders
        if (entry.type === "INCOME" && entry.category !== "SALES") {
          if (entry.paymentMethod === "CASH") {
            cashFromLedger += entry.amount;
          }
        } else if (entry.type === "EXPENSE") {
          if (entry.paymentMethod === "CASH") {
            cashFromLedger -= entry.amount;
          }
        }
      });

      const cash = cashFromSales + cashFromOrders + cashFromLedger;

      const assets = {
        cash: cash || 0,
        inventory: inventory || 0,
        receivables: receivables || 0,
        total: (cash || 0) + (inventory || 0) + (receivables || 0),
      };

      const liabilities = {
        payables: payables || 0,
        total: payables || 0,
      };

      return {
        assets,
        liabilities,
        equity: assets.total - liabilities.total,
      };
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      // Return default values on error
      return {
        assets: {
          cash: 0,
          inventory: 0,
          receivables: 0,
          total: 0,
        },
        liabilities: {
          payables: 0,
          total: 0,
        },
        equity: 0,
      };
    }
  }

  /**
   * Generate Sales Report
   */
  static async generateSalesReport(
    startDate: Date,
    endDate: Date
  ): Promise<SalesReport> {
    try {
      // Get POS sales
      const sales = await SaleService.getSales(startDate, endDate);
      const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);

      // Get online orders (include both CONFIRMED and COMPLETED)
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const ordersRevenue = confirmedOrCompletedOrders.reduce(
        (sum, order) => sum + order.total,
        0
      );

      const totalRevenue = totalSales + ordersRevenue;
      const totalOrderCount = sales.length + confirmedOrCompletedOrders.length;
      const averageOrderValue =
        totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

      // Aggregate by product
      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
      
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const existing = productMap.get(item.productId) || {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          productMap.set(item.productId, existing);
        });
      });

      confirmedOrCompletedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const existing = productMap.get(item.productId) || {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          productMap.set(item.productId, existing);
        });
      });

      const salesByProduct = Array.from(productMap.entries()).map(
        ([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: data.revenue,
        })
      );

      // Aggregate by customer
      const customerMap = new Map<string, { name: string; totalSpent: number; orderCount: number }>();
      
      sales.forEach((sale) => {
        if (sale.customerId) {
          const existing = customerMap.get(sale.customerId) || {
            name: "Unknown",
            totalSpent: 0,
            orderCount: 0,
          };
          existing.totalSpent += sale.total;
          existing.orderCount += 1;
          customerMap.set(sale.customerId, existing);
        }
      });

      confirmedOrCompletedOrders.forEach((order) => {
        if (order.customerId) {
          const existing = customerMap.get(order.customerId) || {
            name: order.customerInfo.name,
            totalSpent: 0,
            orderCount: 0,
          };
          existing.totalSpent += order.total;
          existing.orderCount += 1;
          customerMap.set(order.customerId, existing);
        }
      });

      const salesByCustomer = Array.from(customerMap.entries()).map(
        ([customerId, data]) => ({
          customerId,
          customerName: data.name,
          totalSpent: data.totalSpent,
          orderCount: data.orderCount,
        })
      );

      return {
        totalSales: totalRevenue || 0,
        totalOrders: totalOrderCount || 0,
        averageOrderValue: averageOrderValue || 0,
        salesByProduct: salesByProduct.sort((a, b) => b.revenue - a.revenue) || [],
        salesByCategory: {}, // Would need product category data
        salesByCustomer: salesByCustomer.sort((a, b) => b.totalSpent - a.totalSpent) || [],
      };
    } catch (error) {
      console.error("Error generating sales report:", error);
      // Return default values on error
      return {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        salesByProduct: [],
        salesByCategory: {},
        salesByCustomer: [],
      };
    }
  }

  /**
   * Generate Expense Report
   */
  static async generateExpenseReport(
    startDate: Date,
    endDate: Date
  ): Promise<ExpenseReport> {
    try {
      const entries = await LedgerService.getEntries(
        startDate,
        endDate,
        "EXPENSE"
      );

      const totalExpenses = entries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      const expensesByCategory: Record<string, number> = {};
      entries.forEach((entry) => {
        expensesByCategory[entry.category] =
          (expensesByCategory[entry.category] || 0) + entry.amount;
      });

      const topExpenses = entries
        .map((entry) => ({
          description: entry.description,
          amount: entry.amount,
          category: entry.category,
          date: entry.date.toDate(),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);

      return {
        totalExpenses: totalExpenses || 0,
        expensesByCategory: expensesByCategory || {},
        topExpenses: topExpenses || [],
      };
    } catch (error) {
      console.error("Error generating expense report:", error);
      // Return default values on error
      return {
        totalExpenses: 0,
        expensesByCategory: {},
        topExpenses: [],
      };
    }
  }
}

