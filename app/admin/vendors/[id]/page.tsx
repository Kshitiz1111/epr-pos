"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/lib/types";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      const vendorDoc = await getDoc(doc(db, "vendors", vendorId));
      if (vendorDoc.exists()) {
        setVendor({ id: vendorDoc.id, ...vendorDoc.data() } as Vendor);
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error);
    } finally {
      setLoading(false);
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={vendor.isActive ? "text-green-600 font-medium" : "text-gray-400 font-medium"}>
                    {vendor.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
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

