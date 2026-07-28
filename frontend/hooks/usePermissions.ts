"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Permission, PermissionsResponse, Role } from "@/lib/types";

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => api.get<PermissionsResponse>("/auth/permissions"),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if the current user has a specific permission.
 */
export function useHasPermission(permission: Permission) {
  const { data } = usePermissions();
  return data?.permissions?.includes(permission) ?? false;
}

/**
 * Check if the current user has ANY of the specified permissions.
 */
export function useHasAnyPermission(...permissions: Permission[]) {
  const { data } = usePermissions();
  if (!data?.permissions) return false;
  return permissions.some((p) => data.permissions.includes(p));
}

/**
 * Check if the current user has ALL of the specified permissions.
 */
export function useHasAllPermissions(...permissions: Permission[]) {
  const { data } = usePermissions();
  if (!data?.permissions) return false;
  return permissions.every((p) => data.permissions.includes(p));
}

/**
 * Get the user's role.
 */
export function useUserRole(): Role | undefined {
  const { data } = usePermissions();
  return data?.role;
}
