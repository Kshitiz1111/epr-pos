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
import { LedgerEntry } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { DollarSign, TrendingUp, TrendingDown, FileText, BarChart3, Calendar } from "lucide-react";
import Link from "next/link";

export default function FinancePage() {
  const { hasPermission } = usePermissions();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPL, setDailyPL] = useState({ income: 0, expense: 0, net: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

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

      const [dayEntries, pl] = await Promise.all([
        LedgerService.getEntries(startOfDay, endOfDay),
        LedgerService.getDailyPL(date),
      ]);

      setEntries(dayEntries.slice(0, 20)); // Show last 20 entries
      setDailyPL(pl);
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
                  Today's Income
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
                  Today's Expenses
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
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transactions found for this date.
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
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {entry.date.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                entry.type === "INCOME"
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {entry.type}
                            </span>
                          </TableCell>
                          <TableCell>{entry.category}</TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell>{entry.paymentMethod}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              entry.type === "INCOME" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {entry.type === "INCOME" ? "+" : "-"}Rs {entry.amount.toFixed(2)}
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

