import { PLATFORM_PERMISSION_CODES, STORE_PERMISSION_CODES } from "@/lib/permissions/catalog";

/**
 * Permission domain boundary. A permission is eligible for a panel only when
 * its code belongs to that domain. Two legacy content permissions remain
 * intentionally dual-use while their APIs are being split; all new granular
 * permissions have a single domain.
 */
export const STORE_BOUND_PERMISSION_CODES: ReadonlySet<string> = STORE_PERMISSION_CODES;
export const MERCHANT_PERMISSION_CODES: readonly string[] = [...STORE_PERMISSION_CODES];

export function isPlatformPermission(code: string): boolean {
  return PLATFORM_PERMISSION_CODES.has(code);
}

export function isStorePermission(code: string): boolean {
  return STORE_PERMISSION_CODES.has(code);
}

export function filterPlatformPermissionCodes(codes: readonly string[]): string[] {
  return [...new Set(codes.filter(isPlatformPermission))];
}

export function filterStorePermissionCodes(codes: readonly string[]): string[] {
  return [...new Set(codes.filter(isStorePermission))];
}
