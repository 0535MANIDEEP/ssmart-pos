"use client";

import type { ReactNode } from "react";
import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/types";

interface CanProps {
  /** Required permission (single) */
  permission?: Permission;
  /** Required ANY of these permissions */
  any?: Permission[];
  /** Required ALL of these permissions */
  all?: Permission[];
  /** Content to render if authorized */
  children: ReactNode;
  /** Content to render if NOT authorized (defaults to null) */
  fallback?: ReactNode;
}

/**
 * Conditional rendering component based on permissions.
 *
 * Usage:
 * <Can permission="products:write">
 *   <Button>Add Product</Button>
 * </Can>
 *
 * <Can any={["products:write", "products:delete"]} fallback={<span>Read only</span>}>
 *   <Button>Edit</Button>
 * </Can>
 */
export function Can({ permission, any, all, children, fallback = null }: CanProps) {
  let authorized = false;

  if (permission) {
    authorized = useHasPermission(permission);
  } else if (any) {
    authorized = useHasAnyPermission(...any);
  } else if (all) {
    authorized = useHasAllPermissions(...all);
  } else {
    authorized = true; // no permission constraint = always authorized
  }

  return authorized ? <>{children}</> : <>{fallback}</>;
}
