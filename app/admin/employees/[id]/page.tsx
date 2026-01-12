"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, EmployeeProfile, UserRole, EmployeePermissions } from "@/lib/types";
import { ArrowLeft, BarChart3, Edit, Save, X } from "lucide-react";
import Link from "next/link";

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id as string;
  const [employee, setEmployee] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    role: "staff" as UserRole,
    baseSalary: "",
  });
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);

  const fetchEmployeeData = async () => {
    try {
      // Fetch user data
      const userDoc = await getDoc(doc(db, "users", employeeId));
      let userData: User | null = null;
      if (userDoc.exists()) {
        userData = { id: userDoc.id, ...userDoc.data() } as unknown as User;
        setEmployee(userData);
      }

      // Fetch employee profile
      const employeeDoc = await getDoc(doc(db, "employees", employeeId));
      if (employeeDoc.exists()) {
        const profile = { id: employeeDoc.id, ...employeeDoc.data() } as unknown as EmployeeProfile;
        setEmployeeProfile(profile);
        
        // Use userData instead of employee state (which is async)
        setFormData({
          displayName: userData?.displayName || "",
          role: userData?.role || "staff",
          baseSalary: profile.baseSalary?.toString() || "0",
        });
        
        // Initialize permissions from userData or create default
        // Always merge with complete default structure to ensure all resources are present
        const defaultPermissions: EmployeePermissions = {
          resources: {
            inventory: { view: false, create: false, update: false, delete: false },
            finance: { view: false, create: false, update: false, delete: false },
            customers: {
              view: false,
              create: false,
              update: false,
              delete: false,
              viewCredits: false,
              settleCredits: false,
            },
            employees: { view: false, create: false, update: false, delete: false },
            vendors: { view: false, create: false, update: false, delete: false },
            pos: { view: false, create: false, update: false, delete: false },
            reports: { view: false, create: false, update: false, delete: false },
            orders: { view: false, create: false, update: false, delete: false },
            settings: { view: false, create: false, update: false, delete: false },
            hr: { view: false, create: false, update: false, delete: false },
          },
        };
        
        if (userData?.permissions) {
          // Merge existing permissions with defaults to ensure all resources are present
          const mergedPermissions: EmployeePermissions = {
            resources: {
              ...defaultPermissions.resources,
              ...userData.permissions.resources,
              // Ensure customers resource has all fields
              customers: {
                ...defaultPermissions.resources.customers,
                ...(userData.permissions.resources.customers || {}),
              },
            },
          };
          setPermissions(mergedPermissions);
        } else {
          setPermissions(defaultPermissions);
        }
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);


  const handleSave = async () => {
    if (!employee || !employeeProfile || !permissions) return;

    setSaving(true);
    try {
      // Update user document
      await updateDoc(doc(db, "users", employeeId), {
        displayName: formData.displayName || undefined,
        role: formData.role,
        permissions,
        updatedAt: serverTimestamp(),
      });

      // Update employee profile
      await updateDoc(doc(db, "employees", employeeId), {
        role: formData.role,
        baseSalary: parseFloat(formData.baseSalary) || 0,
        permissions,
        updatedAt: serverTimestamp(),
      });

      setEditing(false);
      await fetchEmployeeData();
      alert("Employee updated successfully");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee");
    } finally {
      setSaving(false);
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
          <div className="flex items-center justify-between">
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
                    fetchEmployeeData();
                  }}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input
                        id="displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{employee.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                  {editing ? (
                    <div className="space-y-2">
                      <Label htmlFor="baseSalary">Base Salary (Rs)</Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.baseSalary}
                        onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">Base Salary</p>
                      <p className="font-medium">Rs {employeeProfile.baseSalary.toFixed(2)}</p>
                    </div>
                  )}
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

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Performance</CardTitle>
                    <CardDescription>View employee sales and attendance history</CardDescription>
                  </div>
                  <Link href={`/admin/employees/${employeeId}/performance`}>
                    <Button variant="outline">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Performance
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>

            {employee.permissions && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>Resource access permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  {editing && permissions ? (
                    <PermissionMatrix permissions={permissions} onChange={setPermissions} />
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

