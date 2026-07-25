"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Client visibility helper only. It reduces misleading buttons; every API
 * still makes the final database-backed authorization decision.
 */
export function useEffectivePermissions(storeId?: string) {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  useEffect(() => {
    let live = true;
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    fetch(`/api/auth/permissions${query}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (live && json.success) setPermissions(new Set(json.data?.permissions || [])); })
      .catch(() => { if (live) setPermissions(new Set()); });
    return () => { live = false; };
  }, [storeId]);
  return permissions;
}

export function PermissionGate({ anyOf, storeId, children, fallback = null }: { anyOf: readonly string[]; storeId?: string; children: ReactNode; fallback?: ReactNode }) {
  const permissions = useEffectivePermissions(storeId);
  const allowed = useMemo(() => Boolean(permissions && anyOf.some((permission) => permissions.has(permission))), [anyOf, permissions]);
  if (permissions === null) return null;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
