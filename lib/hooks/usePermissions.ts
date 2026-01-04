"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EmployeePermissions } from "@/lib/types";

type ResourceName = keyof EmployeePermissions["resources"];
type PermissionAction = "view" | "create" | "update" | "delete" | "viewCredits" | "settleCredits";

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (
    resource: ResourceName,
    action: PermissionAction
  ): boolean => {
    if (!user) return false;

    // Admin has all permissions
    if (user.role === "admin") return true;

    // Check permissions for other roles
    if (user.permissions) {
      const resourcePerms = user.permissions.resources[resource];
      if (!resourcePerms) return false;

      // Handle special permissions for customers resource
      if (resource === "customers") {
        if (action === "viewCredits" || action === "settleCredits") {
          return (resourcePerms as any)[action] === true;
        }
      }

      // Handle standard permissions
      if (action === "view" || action === "create" || action === "update" || action === "delete") {
        return resourcePerms[action] === true;
      }
    }

    return false;
  };

  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;

    // Check route-specific permissions
    if (route.startsWith("/admin/finance")) {
      return hasPermission("finance", "view");
    }
    if (route.startsWith("/admin/inventory")) {
      return hasPermission("inventory", "view");
    }
    if (route.startsWith("/admin/vendors")) {
      return hasPermission("vendors", "view");
    }
    if (route.startsWith("/admin/employees")) {
      return hasPermission("employees", "view");
    }
    if (route.startsWith("/pos")) {
      return hasPermission("pos", "view");
    }

    return false;
  };

  return {
    hasPermission,
    canAccessRoute,
    userRole: user?.role,
    isAdmin: user?.role === "admin",
  };
}

