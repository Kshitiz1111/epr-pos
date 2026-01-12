"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmployeePermissions } from "@/lib/types";

interface PermissionMatrixProps {
  permissions: EmployeePermissions;
  onChange: (permissions: EmployeePermissions) => void;
}

type ResourceName = keyof EmployeePermissions["resources"];

const resourceLabels: Record<ResourceName, string> = {
  inventory: "Inventory",
  finance: "Finance",
  customers: "Customers",
  employees: "Employees",
  vendors: "Vendors",
  pos: "Point of Sale",
  reports: "Reports",
  orders: "Orders",
  hr: "HR",
  settings: "Settings",
};

const actionLabels: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  viewCredits: "View Credits",
  settleCredits: "Settle Credits",
};

// Complete list of all resources - always show all of them
const allResources: ResourceName[] = [
  "inventory",
  "finance",
  "customers",
  "employees",
  "vendors",
  "pos",
  "reports",
  "orders",
  "hr",
  "settings",
];

export function PermissionMatrix({ permissions, onChange }: PermissionMatrixProps) {
  const [localPermissions, setLocalPermissions] = useState<EmployeePermissions>(permissions);

  // Sync localPermissions when permissions prop changes
  useEffect(() => {
    setLocalPermissions(permissions);
  }, [permissions]);

  // Merge permissions with defaults to ensure all resources are present
  const getCompletePermissions = (): EmployeePermissions => {
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

    return {
      resources: {
        ...defaultPermissions.resources,
        ...localPermissions.resources,
        customers: {
          ...defaultPermissions.resources.customers,
          ...(localPermissions.resources.customers || {}),
        },
      },
    };
  };

  const completePermissions = getCompletePermissions();

  const updatePermission = (
    resource: ResourceName,
    action: string,
    value: boolean
  ) => {
    const newPermissions = { ...localPermissions };
    // Ensure resource exists in newPermissions
    if (!newPermissions.resources[resource]) {
      newPermissions.resources[resource] = completePermissions.resources[resource];
    }
    const resourcePerms = newPermissions.resources[resource];

    if (resource === "customers" && (action === "viewCredits" || action === "settleCredits")) {
      (resourcePerms as any)[action] = value;
    } else if (action === "view" || action === "create" || action === "update" || action === "delete") {
      resourcePerms[action] = value;
    }

    setLocalPermissions(newPermissions);
    onChange(newPermissions);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Resource Permissions</CardTitle>
        <CardDescription>
          Select the permissions this employee should have for each resource
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {allResources.map((resource) => {
            const resourcePerms = completePermissions.resources[resource];
            const isCustomers = resource === "customers";

            return (
              <div key={resource} className="space-y-3 border-b pb-4 last:border-b-0">
                <h4 className="font-semibold text-sm">{resourceLabels[resource]}</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Object.keys(resourcePerms).map((action) => {
                    if (typeof resourcePerms[action as keyof typeof resourcePerms] !== "boolean") {
                      // Handle nested permissions for customers
                      if (isCustomers && (action === "viewCredits" || action === "settleCredits")) {
                        return (
                          <div key={action} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${resource}-${action}`}
                              checked={(resourcePerms as any)[action] || false}
                              onCheckedChange={(checked) =>
                                updatePermission(resource, action, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`${resource}-${action}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {actionLabels[action]}
                            </Label>
                          </div>
                        );
                      }
                      return null;
                    }

                    return (
                      <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${resource}-${action}`}
                          checked={resourcePerms[action as keyof typeof resourcePerms] as boolean}
                          onCheckedChange={(checked) =>
                            updatePermission(resource, action, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`${resource}-${action}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {actionLabels[action] || action}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

