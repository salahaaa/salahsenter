import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, handleApiError } from "@/lib/api";

const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
afterEach(() => consoleError.mockClear());

describe("API error status mapping", () => {
  it("preserves explicit safe client status codes", async () => {
    const response = handleApiError(new ApiError("غير مصرح", 401), "fallback");
    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe("غير مصرح");
  });

  it("does not expose arbitrary internal errors", async () => {
    const response = handleApiError(new Error("database internal detail"), "رسالة آمنة");
    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("رسالة آمنة");
  });
});
