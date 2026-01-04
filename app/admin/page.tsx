"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerService } from "@/lib/services/ledgerService";
import { ProductService } from "@/lib/services/productService";
import { VendorService } from "@/lib/services/vendorService";
import { CreditService } from "@/lib/services/creditService";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Link from "next/link";
import {
  DollarSign,
  Package,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const { hasPermission } = usePermissions();
  const [stats, setStats] = useState({
    todayIncome: 0,
    todayExpense: 0,
    totalProducts: 0,
    totalVendors: 0,
    outstandingCredits: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Today's P&L
      const pl = await LedgerService.getDailyPL(new Date());

      // Total products
      const products = await ProductService.getAllProducts();
      const activeProducts = products.filter((p) => p.isActive);

      // Low stock products
      const lowStock = activeProducts.filter((product) => {
        const totalStock = Object.values(product.warehouses).reduce(
          (sum, wh) => sum + wh.quantity,
          0
        );
        const minStock = Math.min(
          ...Object.values(product.warehouses).map((wh) => wh.minQuantity || 0)
        );
        return totalStock > 0 && totalStock <= minStock;
      });

      // Total vendors
      const vendors = await VendorService.getAllVendors();
      const activeVendors = vendors.filter((v) => v.isActive);

      // Outstanding credits
      const credits = await CreditService.getAllOutstandingCredits();
      const totalOutstanding = credits.reduce((sum, credit) => sum + credit.dueAmount, 0);

      setStats({
        todayIncome: pl.income,
        todayExpense: pl.expense,
        totalProducts: activeProducts.length,
        totalVendors: activeVendors.length,
        outstandingCredits: totalOutstanding,
        lowStockProducts: lowStock.length,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const netProfit = stats.todayIncome - stats.todayExpense;

  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your business.</p>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading dashboard data...</div>
          ) : (
            <>
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today's Income
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      Rs {stats.todayIncome.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today's Expenses
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      Rs {stats.todayExpense.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      Rs {netProfit.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Outstanding Credits
                    </CardTitle>
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      Rs {stats.outstandingCredits.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Products
                    </CardTitle>
                    <CardDescription>Total active products in inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalProducts}</div>
                    {stats.lowStockProducts > 0 && (
                      <p className="text-sm text-red-600 mt-2">
                        {stats.lowStockProducts} products low in stock
                      </p>
                    )}
                    {hasPermission("inventory", "view") && (
                      <Link href="/admin/inventory/products">
                        <Button variant="link" className="p-0 mt-2">
                          View Products <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Vendors
                    </CardTitle>
                    <CardDescription>Active suppliers and vendors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalVendors}</div>
                    {hasPermission("vendors", "view") && (
                      <Link href="/admin/vendors">
                        <Button variant="link" className="p-0 mt-2">
                          View Vendors <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Customer Credits
                    </CardTitle>
                    <CardDescription>Outstanding customer dues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      Rs {stats.outstandingCredits.toFixed(2)}
                    </div>
                    {hasPermission("customers", "viewCredits") && (
                      <Link href="/admin/customers/credits">
                        <Button variant="link" className="p-0 mt-2">
                          View Credits <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {hasPermission("pos", "view") && (
                      <Link href="/pos">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <ShoppingCart className="h-6 w-6 mb-2" />
                          Open POS
                        </Button>
                      </Link>
                    )}
                    {hasPermission("inventory", "create") && (
                      <Link href="/admin/inventory/products/create">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <Package className="h-6 w-6 mb-2" />
                          Add Product
                        </Button>
                      </Link>
                    )}
                    {hasPermission("employees", "create") && (
                      <Link href="/admin/employees/create">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <Users className="h-6 w-6 mb-2" />
                          Add Employee
                        </Button>
                      </Link>
                    )}
                    {hasPermission("finance", "view") && (
                      <Link href="/admin/finance/ledger">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <DollarSign className="h-6 w-6 mb-2" />
                          View Ledger
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

