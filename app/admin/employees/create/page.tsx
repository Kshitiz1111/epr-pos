"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { UserRole, EmployeePermissions } from "@/lib/types";

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
    hr: { view: false, create: false, update: false, delete: false },
    settings: { view: false, create: false, update: false, delete: false },
  },
};

export default function CreateEmployeePage() {
  const router = useRouter();
  const { createEmployee, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "staff" as UserRole,
    baseSalary: "",
  });

  const [permissions, setPermissions] = useState<EmployeePermissions>(defaultPermissions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Create employee account (this now handles both user and employee profile creation)
      await createEmployee(
        formData.email,
        formData.password,
        formData.role,
        permissions,
        formData.displayName,
        formData.baseSalary ? parseFloat(formData.baseSalary) : undefined
      );

      router.push("/admin/employees");
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout>
        <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create New Employee</h1>
          <p className="text-gray-600 mt-2">Add a new employee and assign their permissions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Employee account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Full Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseSalary">Base Salary (Rs)</Label>
                <Input
                  id="baseSalary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          <PermissionMatrix permissions={permissions} onChange={setPermissions} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Employee"}
            </Button>
          </div>
        </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

