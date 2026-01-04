"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { CreditService } from "@/lib/services/creditService";
import { Customer, CreditTransaction, Sale } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, DollarSign } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesWarning, setSalesWarning] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<CreditTransaction | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
      fetchCredits();
      fetchSales();
    }
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      const customerDoc = await getDoc(doc(db, "customers", customerId));
      if (customerDoc.exists()) {
        setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    setLoadingCredits(true);
    setCreditsError(null);
    try {
      const customerCredits = await CreditService.getCustomerCredits(customerId);
      setCredits(customerCredits);
      console.log(`Fetched ${customerCredits.length} credit transactions for customer ${customerId}`);
    } catch (error: any) {
      console.error("Error fetching credits:", error);
      const errorMessage = error.message || "Failed to load credit history";
      setCreditsError(errorMessage);
      
      // Check if it's a missing index error
      if (error.code === "failed-precondition" || error.message?.includes("index")) {
        setCreditsError(
          "Credit history query requires a Firestore index. Please create a composite index on (customerId, createdAt) for the credit_transactions collection."
        );
      }
    } finally {
      setLoadingCredits(false);
    }
  };

  const fetchSales = async () => {
    setLoadingSales(true);
    setSalesError(null);
    try {
      // Try query with orderBy first (requires composite index)
      let q = query(
        collection(db, "sales"),
        where("customerId", "==", customerId),
        orderBy("createdAt", "desc")
      );
      
      try {
        const querySnapshot = await getDocs(q);
        const salesList: Sale[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          salesList.push({ id: doc.id, ...data } as Sale);
        });
        setSales(salesList);
        console.log(`Fetched ${salesList.length} sales for customer ${customerId}`);
      } catch (indexError: any) {
        // If index is missing, try without orderBy and sort in memory
        if (indexError.code === "failed-precondition" || indexError.message?.includes("index")) {
          console.warn("Composite index missing, fetching without orderBy and sorting in memory");
          q = query(
            collection(db, "sales"),
            where("customerId", "==", customerId)
          );
          const querySnapshot = await getDocs(q);
          const salesList: Sale[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            salesList.push({ id: doc.id, ...data } as Sale);
          });
          
          // Sort in memory by createdAt descending
          salesList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });
          
          setSales(salesList);
          console.log(`Fetched ${salesList.length} sales for customer ${customerId} (sorted in memory)`);
          setSalesWarning(
            "Note: A Firestore composite index on (customerId, createdAt) is recommended for better performance."
          );
        } else {
          throw indexError;
        }
      }
    } catch (error: any) {
      console.error("Error fetching sales:", error);
      const errorMessage = error.message || "Failed to load purchase history";
      setSalesError(errorMessage);
    } finally {
      setLoadingSales(false);
    }
  };

  // Calculate and update totalSpent from sales
  const calculateAndUpdateTotalSpent = async () => {
    if (!customer || !customerId || loadingSales) return;

    try {
      const calculatedTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
      const currentTotal = customer.totalSpent || 0;
      
      // Update if different (with small tolerance for floating point)
      if (Math.abs(calculatedTotal - currentTotal) > 0.01) {
        console.log(`Updating totalSpent: ${currentTotal} -> ${calculatedTotal} for customer ${customerId}`);
        await updateDoc(doc(db, "customers", customerId), {
          totalSpent: calculatedTotal,
        });
        // Refresh customer data
        fetchCustomerData();
      }
    } catch (error) {
      console.error("Error calculating/updating totalSpent:", error);
    }
  };

  // Recalculate totalSpent when both customer and sales are loaded
  useEffect(() => {
    if (customer && !loadingSales) {
      calculateAndUpdateTotalSpent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, loadingSales, sales.length]);

  const handleSettle = async () => {
    if (!selectedCredit || !user) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > selectedCredit.dueAmount) {
      alert(`Amount cannot exceed due amount of Rs ${selectedCredit.dueAmount.toFixed(2)}`);
      return;
    }

    try {
      await CreditService.settleCredit(
        selectedCredit.id,
        amount,
        user.uid,
        settlementNotes || undefined
      );
      setSelectedCredit(null);
      setSettlementAmount("");
      setSettlementNotes("");
      fetchCredits();
      fetchCustomerData();
      alert("Credit settled successfully");
    } catch (error: any) {
      alert(error.message || "Failed to settle credit");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: "customers", action: "view" }}>
        <AdminLayout>
          <div className="text-center py-12">Loading customer details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!customer) {
    return (
      <ProtectedRoute requiredPermission={{ resource: "customers", action: "view" }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Customer not found</h1>
            <Link href="/admin/customers">
              <Button>Back to Customers</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const outstandingCredits = credits.filter((c) => c.dueAmount > 0);
  const totalOutstanding = outstandingCredits.reduce((sum, c) => sum + c.dueAmount, 0);

  return (
    <ProtectedRoute requiredPermission={{ resource: "customers", action: "view" }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/customers">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{customer.name}</h1>
              <p className="text-gray-600 mt-1">Customer Details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
                {customer.email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{customer.email}</p>
                  </div>
                )}
                {customer.address && (
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="font-medium">{customer.address}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Member Since</p>
                  <p className="font-medium">
                    {customer.createdAt.toDate().toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-green-600">
                    Rs {(customer.totalSpent || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding Due</p>
                  <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                    Rs {totalOutstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Loyalty Points</p>
                  <p className="text-lg font-medium">{customer.loyaltyPoints}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Purchases</p>
                  <p className="text-2xl font-bold">{sales.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Credits</p>
                  <p className="text-lg font-medium">{outstandingCredits.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {outstandingCredits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Credits</CardTitle>
                <CardDescription>Credit transactions with pending payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingCredits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell className="font-mono text-sm">{credit.saleId}</TableCell>
                          <TableCell>
                            {credit.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>Rs {credit.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">
                            Rs {credit.paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-red-600 font-semibold">
                            Rs {credit.dueAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasPermission("customers", "settleCredits") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedCredit(credit);
                                  setSettlementAmount(credit.dueAmount.toString());
                                }}
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Settle
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedCredit && (
            <Card>
              <CardHeader>
                <CardTitle>Settle Credit</CardTitle>
                <CardDescription>
                  Settle payment for sale #{selectedCredit.saleId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-lg font-semibold">Rs {selectedCredit.totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Due Amount</p>
                    <p className="text-lg font-semibold text-red-600">
                      Rs {selectedCredit.dueAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Settlement Amount (Rs)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                    max={selectedCredit.dueAmount}
                    placeholder="Enter amount to settle"
                  />
                  <p className="text-xs text-gray-500">
                    Maximum: Rs {selectedCredit.dueAmount.toFixed(2)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    type="text"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    placeholder="Payment notes"
                  />
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleSettle}>Settle Payment</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCredit(null);
                      setSettlementAmount("");
                      setSettlementNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>All sales transactions for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <div className="text-center py-8">Loading purchase history...</div>
              ) : salesError ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-semibold">Error loading purchase history</p>
                    <p className="text-sm mt-1">{salesError}</p>
                  </div>
                  <Button variant="outline" onClick={fetchSales}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  {salesWarning && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
                      <p className="text-sm">{salesWarning}</p>
                    </div>
                  )}
                  {sales.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No purchase history found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-sm">{sale.id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            {sale.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>{sale.items.length} items</TableCell>
                          <TableCell className="font-medium">
                            Rs {sale.total.toFixed(2)}
                          </TableCell>
                          <TableCell>{sale.paymentMethod}</TableCell>
                          <TableCell>
                            {sale.dueAmount > 0 ? (
                              <span className="text-red-600 font-medium">Credit</span>
                            ) : (
                              <span className="text-green-600 font-medium">Paid</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit History</CardTitle>
              <CardDescription>All credit transactions for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCredits ? (
                <div className="text-center py-8">Loading credit history...</div>
              ) : creditsError ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-semibold">Error loading credit history</p>
                    <p className="text-sm mt-1">{creditsError}</p>
                  </div>
                  <Button variant="outline" onClick={fetchCredits}>
                    Retry
                  </Button>
                </div>
              ) : credits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No credit transactions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell className="font-mono text-sm">{credit.saleId}</TableCell>
                          <TableCell>
                            {credit.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>Rs {credit.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">
                            Rs {credit.paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {credit.dueAmount > 0 ? (
                              <span className="text-red-600 font-semibold">
                                Rs {credit.dueAmount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-green-600">Rs 0.00</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {credit.dueAmount > 0 ? (
                              <span className="text-yellow-600 font-medium">Pending</span>
                            ) : (
                              <span className="text-green-600 font-medium">Settled</span>
                            )}
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

