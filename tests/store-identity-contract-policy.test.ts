import { describe, expect, it } from "vitest";
import { addendumTitleForIdentityChange, identityChangeRequestSchema, protectedStoreIdentityFields, protectedStoreValue } from "@/lib/contracts/identity-policy";
import { buildIdentityChangeAddendum } from "@/lib/contracts/addendums";

describe("contract-governed store identity", () => {
  it("limits merchant-requestable protected fields to commercial name and approved contact email", () => {
    expect(protectedStoreIdentityFields).toEqual(["store_name", "contact_email"]);
    expect(identityChangeRequestSchema.safeParse({ fieldKey: "slug", requestedValue: "new", reason: "سبب كافٍ لتغيير الحقل" }).success).toBe(false);
    expect(identityChangeRequestSchema.safeParse({ fieldKey: "contact_email", requestedValue: "invalid", reason: "سبب كافٍ لتغيير البريد" }).success).toBe(false);
  });

  it("captures current value and renders a signed addendum instead of silently changing identity", () => {
    expect(protectedStoreValue({ fieldKey: "store_name", store: { name: "المتجر القديم", contactEmail: "old@example.test" } })).toBe("المتجر القديم");
    const body = buildIdentityChangeAddendum({ contractNumber: "CTR-1", storeNumber: "ST-1", storeName: "المتجر القديم", fieldKey: "contact_email", currentValue: "old@example.test", requestedValue: "new@example.test", reason: "تغيير البريد الرسمي للشركة", version: "1.1" });
    expect(body).toContain("old@example.test");
    expect(body).toContain("new@example.test");
    expect(addendumTitleForIdentityChange("store_name")).toContain("الاسم التجاري");
  });
});
