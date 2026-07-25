import { describe, expect, it } from "vitest";
import { ADMIN_OPERATION_PERMISSIONS } from "@/lib/rbac";
import { isPlatformPermission } from "@/lib/permission-scopes";

describe("incomplete store hard deletion permission", () => {
  it("keeps abandoned-store deletion narrower than general store management", () => {
    expect(isPlatformPermission("stores.incomplete.delete")).toBe(true);
    expect(ADMIN_OPERATION_PERMISSIONS["stores.incomplete.delete"]).toEqual(["stores.incomplete.delete", "stores.delete", "stores.manage"]);
  });
});
