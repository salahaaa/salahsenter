import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storage = readFileSync("lib/private-documents-storage.ts", "utf8");
const uploadRoute = readFileSync("app/api/media/upload/route.ts", "utf8");
const archive = readFileSync("lib/onboarding/application-pdf-archive.ts", "utf8");
const documentDownload = readFileSync("app/api/merchant-applications/[id]/documents/[documentId]/download/route.ts", "utf8");
const archiveDownload = readFileSync("app/api/merchant-applications/[id]/archives/[archiveId]/download/route.ts", "utf8");
const signatureDownload = readFileSync("app/api/merchant-applications/[id]/signature/route.ts", "utf8");

describe("private legal document storage policy", () => {
  it("requires a private R2 configuration in production and never returns a public object URL", () => {
    expect(storage).toContain("Production requires PRIVATE_DOCUMENTS_STORAGE_PROVIDER=r2");
    expect(storage).toContain("PRIVATE_DOCUMENT_URL_PREFIX");
    expect(storage).toContain("private-r2://");
    expect(storage).toContain("Private R2 document storage is not configured");
  });

  it("routes onboarding documents and generated archives through private storage", () => {
    expect(uploadRoute).toContain("isPrivateDocumentFolder(folder)");
    expect(uploadRoute).toContain("uploadPrivateDocument");
    expect(archive).toContain("uploadPrivateDocumentBuffer");
    expect(archive).not.toContain("uploadMediaFile(file, `merchant-application-archives");
  });

  it("serves private files only after application ownership or super-admin authorization", () => {
    for (const source of [documentDownload, archiveDownload, signatureDownload]) {
      expect(source).toContain('hasRole(session, "super_admin")');
      expect(source).toContain("private, no-store");
      expect(source).toContain("readPrivateDocument");
    }
  });
});
