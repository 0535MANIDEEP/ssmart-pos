"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/types";

interface RouteGuardProps {
  /** Required permission to access this route */
  permission?: Permission;
  /** Required role to access this route */
  role?: string;
  /** Content to render if authorized */
  children: React.ReactNode;
}

/**
 * Route guard component. Wraps pages that need permission/role checks.
 * Redirects to /dashboard if unauthorized.
 *
 * Usage:
 * <RouteGuard permission="accounting:read">
 *   <AccountingPage />
 * </RouteGuard>
 */
export function RouteGuard({ permission, role, children }: RouteGuardProps) {
  const router = useRouter();
  const { data: perms, isLoading } = usePermissions();

  useEffect(() => {
    if (isLoading) return;

    if (!perms) {
      router.replace("/dashboard");
      return;
    }

    if (permission && !perms.permissions.includes(permission)) {
      router.replace("/dashboard");
      return;
    }

    if (role && perms.role !== role) {
      router.replace("/dashboard");
      return;
    }
  }, [perms, isLoading, permission, role, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!perms) return null;

  if (permission && !perms.permissions.includes(permission)) return null;
  if (role && perms.role !== role) return null;

  return <>{children}</>;
}
