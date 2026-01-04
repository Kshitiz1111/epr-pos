"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, EmployeeProfile } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const [employee, setEmployee] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    try {
      // Fetch user data
      const userDoc = await getDoc(doc(db, "users", employeeId));
      if (userDoc.exists()) {
        setEmployee({ id: userDoc.id, ...userDoc.data() } as User);
      }

      // Fetch employee profile
      const employeeDoc = await getDoc(doc(db, "employees", employeeId));
      if (employeeDoc.exists()) {
        setEmployeeProfile({ id: employeeDoc.id, ...employeeDoc.data() } as EmployeeProfile);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <AdminLayout>
          <div className="text-center py-12">Loading employee details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!employee) {
    return (
      <ProtectedRoute requiredRole="admin">
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Employee not found</h1>
            <Link href="/admin/employees">
              <Button>Back to Employees</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/employees">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{employee.displayName || "Employee"}</h1>
              <p className="text-gray-600 mt-1">Employee Details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-medium">{employee.displayName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="font-medium capitalize">{employee.role}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email Verified</p>
                  <p className={employee.emailVerified ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                    {employee.emailVerified ? "Yes" : "Pending"}
                  </p>
                </div>
                {employee.createdAt && (
                  <div>
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="font-medium">
                      {employee.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {employeeProfile && (
              <Card>
                <CardHeader>
                  <CardTitle>Employee Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium capitalize">{employeeProfile.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Base Salary</p>
                    <p className="font-medium">Rs {employeeProfile.baseSalary.toFixed(2)}</p>
                  </div>
                  {employeeProfile.joiningDate && (
                    <div>
                      <p className="text-sm text-gray-600">Joining Date</p>
                      <p className="font-medium">
                        {employeeProfile.joiningDate.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Current Advance</p>
                    <p className="font-medium">Rs {employeeProfile.finance.currentAdvance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Unpaid Commissions</p>
                    <p className="font-medium">Rs {employeeProfile.finance.unpaidCommissions.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {employee.permissions && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>Resource access permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(employee.permissions.resources).map(([resource, perms]) => (
                      <div key={resource} className="border rounded p-4">
                        <h4 className="font-semibold mb-2 capitalize">{resource}</h4>
                        <div className="space-y-1 text-sm">
                          {Object.entries(perms).map(([action, allowed]) => {
                            if (typeof allowed === "boolean") {
                              return (
                                <div key={action} className="flex justify-between">
                                  <span className="capitalize">{action}:</span>
                                  <span className={allowed ? "text-green-600" : "text-gray-400"}>
                                    {allowed ? "✓" : "✗"}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

