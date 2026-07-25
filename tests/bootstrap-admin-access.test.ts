import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync("scripts/bootstrap-admin.ts", "utf8");
const loginForm = readFileSync("components/auth/login-form.tsx", "utf8");
const accountSecurity = readFileSync("app/account/security/page.tsx", "utf8");
const workflow = readFileSync(".github/workflows/bootstrap-first-admin.yml", "utf8");

describe("bootstrap administrator first-login access", () => {
  it("requires a strong one-time bootstrap password and assigns super_admin only when no active owner exists", () => {
    expect(bootstrap).toContain('password.length < 16');
    expect(bootstrap).toContain('roles.code, "super_admin"');
    expect(bootstrap).toContain("يوجد مسؤول نشط بالفعل");
    expect(bootstrap).toContain("mustChangePassword: true");
  });

  it("sends first-login password changes to an account-wide security page rather than merchant-only settings", () => {
    expect(loginForm).toContain("/account/security?mustChangePassword=1");
    expect(loginForm).not.toContain("/merchant/settings?mustChangePassword=1");
    expect(accountSecurity).toContain("requireAuth()");
    expect(accountSecurity).toContain("ChangePasswordForm");
  });

  it("uses protected GitHub environment secrets and an explicit manual confirmation", () => {
    expect(workflow).toContain("BOOTSTRAP_FIRST_ADMIN");
    expect(workflow).toContain("ADMIN_BOOTSTRAP_PASSWORD");
    expect(workflow).toContain("npm run db:migrate");
    expect(workflow).toContain("npm run admin:bootstrap");
    const dispatchInputs = workflow.slice(workflow.indexOf("workflow_dispatch:"), workflow.indexOf("permissions:"));
    expect(dispatchInputs).not.toMatch(/^\s*password\s*:/im);
  });
});
