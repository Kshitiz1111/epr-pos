"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LedgerService } from "@/lib/services/ledgerService";
import { SaleService } from "@/lib/services/saleService";
import { OrderService } from "@/lib/services/orderService";
import { LedgerEntry, Sale, Order } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { DollarSign, TrendingUp, TrendingDown, FileText, BarChart3, Calendar } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

type UnifiedTransaction = {
  id: string;
  date: Timestamp;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  source?: "LEDGER" | "POS" | "ONLINE";
};

export default function FinancePage() {
  const { hasPermission } = usePermissions();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPL, setDailyPL] = useState({ income: 0, expense: 0, net: 0 });
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today's date
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    fetchFinanceData();
  }, [selectedDate]);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const date = new Date(selectedDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get actual sales and orders for accurate income calculation
      const [dayEntries, sales, orders] = await Promise.all([
        LedgerService.getEntries(startOfDay, endOfDay),
        SaleService.getSales(startOfDay, endOfDay),
        OrderService.getAllOrders({
          startDate: startOfDay,
          endDate: endOfDay,
        }),
      ]);

      // Calculate income from actual sales and orders
      const posSalesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const onlineOrdersRevenue = confirmedOrCompletedOrders.reduce(
        (sum, order) => sum + order.total,
        0
      );

      // Get expenses and other income from ledger (excluding auto-generated sales entries)
      const manualLedgerEntriesForPL = dayEntries.filter((entry) => {
        // Exclude auto-generated sales entries
        if (entry.category === "SALES" && entry.relatedId) {
          return false;
        }
        return true;
      });
      
      const expenses = manualLedgerEntriesForPL
        .filter((e) => e.type === "EXPENSE")
        .reduce((sum, e) => sum + e.amount, 0);
      const otherIncome = manualLedgerEntriesForPL
        .filter((e) => e.type === "INCOME" && e.category !== "SALES")
        .reduce((sum, e) => sum + e.amount, 0);

      const totalIncome = posSalesRevenue + onlineOrdersRevenue + otherIncome;
      const netProfit = totalIncome - expenses;

      // Filter out ledger entries that are auto-generated from sales/orders
      // These entries are created automatically when sales/orders are made
      // and we're already showing the actual sales/orders, so we don't need the ledger duplicates
      const manualLedgerEntries = dayEntries.filter((entry) => {
        // Exclude entries that are related to sales/orders
        // These are auto-generated and we're already showing the actual sales/orders
        if (entry.category === "SALES" && entry.relatedId) {
          return false; // This is an auto-generated entry from a sale/order
        }
        return true; // Include all other entries (expenses, manual income, etc.)
      });

      // Create unified transaction list
      const unifiedTransactions: UnifiedTransaction[] = [];

      // Add manual ledger entries (excluding auto-generated sales entries)
      manualLedgerEntries.forEach((entry) => {
        unifiedTransactions.push({
          id: entry.id,
          date: entry.date,
          type: entry.type === "INCOME" ? "INCOME" : "EXPENSE",
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          paymentMethod: entry.paymentMethod,
          source: "LEDGER",
        });
      });

      // Add POS sales as income
      sales.forEach((sale) => {
        unifiedTransactions.push({
          id: sale.id,
          date: sale.createdAt,
          type: "INCOME",
          category: "SALES",
          description: `POS Sale #${sale.id.substring(0, 8)}`,
          amount: sale.total,
          paymentMethod: sale.paymentMethod,
          source: "POS",
        });
      });

      // Add online orders (confirmed/completed) as income
      confirmedOrCompletedOrders.forEach((order) => {
        unifiedTransactions.push({
          id: order.id,
          date: order.createdAt,
          type: "INCOME",
          category: "SALES",
          description: `Online Order #${order.orderNumber || order.id.substring(0, 8)}`,
          amount: order.total,
          paymentMethod: order.paymentMethod,
          source: "ONLINE",
        });
      });

      // Sort by date descending (newest first)
      unifiedTransactions.sort((a, b) => {
        const aTime = a.date.toMillis();
        const bTime = b.date.toMillis();
        return bTime - aTime;
      });

      setTransactions(unifiedTransactions.slice(0, 50)); // Show last 50 transactions
      setDailyPL({
        income: totalIncome,
        expense: expenses,
        net: netProfit,
      });
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: "finance", action: "view" }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Finance</h1>
              <p className="text-gray-600 mt-1">Financial overview and management</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFilter">Date</Label>
                <Input
                  id="dateFilter"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  {new Date(selectedDate).toDateString() === new Date().toDateString()
                    ? "Today's Income"
                    : "Income"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  Rs {dailyPL.income.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  {new Date(selectedDate).toDateString() === new Date().toDateString()
                    ? "Today's Expenses"
                    : "Expenses"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  Rs {dailyPL.expense.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Net
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    dailyPL.net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  Rs {dailyPL.net.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/admin/finance/ledger">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Ledger
                  </CardTitle>
                  <CardDescription>View and manage all financial transactions</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/finance/reports">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Reports
                  </CardTitle>
                  <CardDescription>
                    P&L, Cash Flow, Balance Sheet, Sales & Expense Reports
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/finance/analytics">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Analytics
                  </CardTitle>
                  <CardDescription>
                    Profit margins, trends, top products & customers
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Latest financial entries for {new Date(selectedDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transactions found for {new Date(selectedDate).toLocaleDateString()}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {transaction.date.toDate().toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                transaction.type === "INCOME"
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {transaction.type}
                            </span>
                          </TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>
                            {transaction.source && (
                              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                                {transaction.source}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{transaction.paymentMethod}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              transaction.type === "INCOME" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {transaction.type === "INCOME" ? "+" : "-"}Rs {transaction.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}


