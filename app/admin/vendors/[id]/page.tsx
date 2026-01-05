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
import { VendorService } from "@/lib/services/vendorService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor, PaymentMethod } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { ArrowLeft, Building2, DollarSign, Edit, Save, X } from "lucide-react";
import Link from "next/link";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const { hasPermission } = usePermissions();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    imageUrl?: string;
    performedBy: string;
    createdAt: any;
  }>>([]);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    category: "",
  });

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
      fetchPaymentHistory();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      const vendorData = await VendorService.getVendor(vendorId);
      setVendor(vendorData);
      setFormData({
        companyName: vendorData.companyName,
        contactPerson: vendorData.contactPerson,
        phone: vendorData.phone,
        email: vendorData.email || "",
        address: vendorData.address || "",
        category: vendorData.category || "",
      });
    } catch (error) {
      console.error("Error fetching vendor data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await VendorService.getVendorPaymentHistory(vendorId);
      setPaymentHistory(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    if (!vendor) return;

    setSaving(true);
    try {
      await VendorService.updateVendor(vendorId, {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        category: formData.category || undefined,
      });
      setEditing(false);
      await fetchVendorData();
      alert("Vendor updated successfully");
    } catch (error) {
      console.error("Error updating vendor:", error);
      alert("Failed to update vendor");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: "vendors", action: "view" }}>
        <AdminLayout>
          <div className="text-center py-12">Loading vendor details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!vendor) {
    return (
      <ProtectedRoute requiredPermission={{ resource: "vendors", action: "view" }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
            <Link href="/admin/vendors">
              <Button>Back to Vendors</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: "vendors", action: "view" }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/vendors">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">{vendor.companyName}</h1>
                <p className="text-gray-600 mt-1">Vendor Details</p>
              </div>
            </div>
            {hasPermission("vendors", "update") && (
              <>
                {!editing ? (
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        fetchVendorData();
                      }}
                      disabled={saving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input
                        id="contactPerson"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address (Optional)</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category (Optional)</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Electronics, Furniture, etc."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Company Name</p>
                      <p className="font-medium">{vendor.companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Contact Person</p>
                      <p className="font-medium">{vendor.contactPerson}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{vendor.phone}</p>
                    </div>
                    {vendor.email && (
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{vendor.email}</p>
                      </div>
                    )}
                    {vendor.address && (
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium">{vendor.address}</p>
                      </div>
                    )}
                    {vendor.category && (
                      <div>
                        <p className="text-sm text-gray-600">Category</p>
                        <p className="font-medium">{vendor.category}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className={vendor.isActive ? "text-green-600 font-medium" : "text-gray-400 font-medium"}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${vendor.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    Rs {vendor.balance.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {vendor.balance > 0 ? "Amount owed to vendor" : "No outstanding balance"}
                  </p>
                </div>
                {vendor.createdAt && (
                  <div>
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="font-medium">
                      {vendor.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {vendor.balance > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Settle Payment</CardTitle>
                <CardDescription>Record payment to reduce outstanding balance</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/vendors/${vendorId}/settle-payment`}>
                  <Button>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Settle Payment (Rs {vendor.balance.toFixed(2)})
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>History of payments made to this vendor</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-4">Loading payment history...</div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No payment history available</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Performed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                        </TableCell>
                        <TableCell>Rs {payment.amount.toFixed(2)}</TableCell>
                        <TableCell>{payment.paymentMethod}</TableCell>
                        <TableCell>{payment.notes || "-"}</TableCell>
                        <TableCell>{payment.performedBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>View all purchase orders for this vendor</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/vendors/${vendorId}/purchase-orders/create`}>
                    <Button>
                      <Building2 className="mr-2 h-4 w-4" />
                      Create Purchase Order
                    </Button>
                  </Link>
                  <Link href={`/admin/vendors/${vendorId}/purchase-orders`}>
                    <Button variant="outline">
                      View Purchase Orders
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

