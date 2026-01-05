"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LedgerService } from "@/lib/services/ledgerService";
import { SaleService } from "@/lib/services/saleService";
import { OrderService } from "@/lib/services/orderService";
import { LedgerCategory, PaymentMethod } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Plus, Calendar } from "lucide-react";

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

export default function LedgerPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPL, setDailyPL] = useState({ income: 0, expense: 0, net: 0 });
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0]; // Default to today
  });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "OTHER" as LedgerCategory,
    amount: "",
    description: "",
    paymentMethod: "CASH" as PaymentMethod,
  });

  const fetchDayBook = useCallback(async () => {
    setLoading(true);
    try {
      const date = new Date(selectedDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all transaction types
      const [dayBookEntries, sales, orders] = await Promise.all([
        LedgerService.getEntries(startOfDay, endOfDay),
        SaleService.getSales(startOfDay, endOfDay),
        OrderService.getAllOrders({
          startDate: startOfDay,
          endDate: endOfDay,
        }),
      ]);

      // Filter out ledger entries that are auto-generated from sales/orders
      // These entries are created automatically when sales/orders are made
      // and we're already showing the actual sales/orders, so we don't need the ledger duplicates
      const manualLedgerEntries = dayBookEntries.filter((entry) => {
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
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
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

      setTransactions(unifiedTransactions);
    } catch (error) {
      console.error("Error fetching day book:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchDailyPL = useCallback(async () => {
    try {
      const date = new Date(selectedDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get actual sales and orders for accurate income calculation
      const [sales, orders, entries] = await Promise.all([
        SaleService.getSales(startOfDay, endOfDay),
        OrderService.getAllOrders({
          startDate: startOfDay,
          endDate: endOfDay,
        }),
        LedgerService.getEntries(startOfDay, endOfDay),
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
      const manualLedgerEntriesForPL = entries.filter((entry) => {
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

      setDailyPL({
        income: totalIncome,
        expense: expenses,
        net: netProfit,
      });
    } catch (error) {
      console.error("Error fetching daily P&L:", error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDayBook();
    fetchDailyPL();
  }, [fetchDayBook, fetchDailyPL]);


  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await LedgerService.createExpense(
        expenseForm.category,
        parseFloat(expenseForm.amount),
        expenseForm.description,
        expenseForm.paymentMethod,
        user.uid
      );
      setExpenseForm({
        category: "OTHER",
        amount: "",
        description: "",
        paymentMethod: "CASH",
      });
      setShowExpenseForm(false);
      fetchDayBook();
      fetchDailyPL();
    } catch (error) {
      console.error("Error creating expense:", error);
      alert("Failed to create expense");
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: "finance", action: "view" }}>
      <AdminLayout>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Finance Ledger</h1>
            <p className="text-gray-600 mt-2">Track all financial transactions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFilter" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date
              </Label>
              <Input
                id="dateFilter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            {hasPermission("finance", "create") && (
              <div className="flex items-end">
                <Button onClick={() => setShowExpenseForm(!showExpenseForm)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Daily P&L Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
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
              <CardTitle className="text-sm font-medium text-gray-600">
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
              <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${dailyPL.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                Rs {dailyPL.net.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {showExpenseForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Add Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={expenseForm.category}
                      onValueChange={(value) =>
                        setExpenseForm({ ...expenseForm, category: value as LedgerCategory })
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SALARY">Salary</SelectItem>
                        <SelectItem value="RENT">Rent</SelectItem>
                        <SelectItem value="UTILITY">Utility</SelectItem>
                        <SelectItem value="VENDOR_PAY">Vendor Payment</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (Rs)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={expenseForm.paymentMethod}
                    onValueChange={(value) =>
                      setExpenseForm({ ...expenseForm, paymentMethod: value as PaymentMethod })
                    }
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="FONE_PAY">FonePay</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4">
                  <Button type="submit">Create Expense</Button>
                  <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Day Book</CardTitle>
            <CardDescription>
              All transactions for {new Date(selectedDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
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
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
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
                                ? "text-green-600 font-semibold"
                                : "text-red-600 font-semibold"
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
                        <TableCell className="font-medium">
                          <span
                            className={
                              transaction.type === "INCOME" ? "text-green-600" : "text-red-600"
                            }
                          >
                            {transaction.type === "INCOME" ? "+" : "-"}Rs {transaction.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.paymentMethod}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AdminLayout>
    </ProtectedRoute>
  );
}


