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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LedgerService } from "@/lib/services/ledgerService";
import { LedgerEntry, LedgerCategory, PaymentMethod } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Plus } from "lucide-react";

export default function LedgerPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPL, setDailyPL] = useState({ income: 0, expense: 0, net: 0 });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "OTHER" as LedgerCategory,
    amount: "",
    description: "",
    paymentMethod: "CASH" as PaymentMethod,
  });

  useEffect(() => {
    fetchDayBook();
    fetchDailyPL();
  }, []);

  const fetchDayBook = async () => {
    try {
      const dayBookEntries = await LedgerService.getDayBook();
      setEntries(dayBookEntries);
    } catch (error) {
      console.error("Error fetching day book:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyPL = async () => {
    try {
      const pl = await LedgerService.getDailyPL(new Date());
      setDailyPL(pl);
    } catch (error) {
      console.error("Error fetching daily P&L:", error);
    }
  };

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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Finance Ledger</h1>
            <p className="text-gray-600 mt-2">Track all financial transactions</p>
          </div>
          {hasPermission("finance", "create") && (
            <Button onClick={() => setShowExpenseForm(!showExpenseForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          )}
        </div>

        {/* Daily P&L Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Today's Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                Rs {dailyPL.income.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Today's Expenses</CardTitle>
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
            <CardDescription>All transactions for today</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No transactions found for today.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.date.toDate().toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              entry.type === "INCOME"
                                ? "text-green-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {entry.type}
                          </span>
                        </TableCell>
                        <TableCell>{entry.category}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="font-medium">
                          Rs {entry.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{entry.paymentMethod}</TableCell>
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

