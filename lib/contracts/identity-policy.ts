import { z } from "zod";

export const protectedStoreIdentityFields = ["store_name", "contact_email"] as const;
export type ProtectedStoreIdentityField = (typeof protectedStoreIdentityFields)[number];

export const identityChangeRequestSchema = z.object({
  fieldKey: z.enum(protectedStoreIdentityFields),
  requestedValue: z.string().trim().min(2).max(255),
  reason: z.string().trim().min(10).max(2_000)
}).superRefine((value, context) => {
  if (value.fieldKey === "contact_email" && !z.string().email().safeParse(value.requestedValue).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requestedValue"], message: "البريد الإلكتروني الجديد غير صحيح" });
  }
});

export function protectedStoreValue(input: { fieldKey: ProtectedStoreIdentityField; store: { name: string; contactEmail: string | null } }) {
  return input.fieldKey === "store_name" ? input.store.name : input.store.contactEmail || "";
}

export function addendumTitleForIdentityChange(fieldKey: ProtectedStoreIdentityField) {
  return fieldKey === "store_name" ? "ملحق تعديل الاسم التجاري للمتجر" : "ملحق تعديل البريد الإلكتروني المعتمد للمتجر";
}
