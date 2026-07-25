import { describe, expect, it } from "vitest";
import { assessImageDimensions, inspectImageQuality, readImageDimensions } from "@/lib/media/image-quality";

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

describe("product image quality gate", () => {
  it("reads image dimensions without decoding the complete image", () => {
    expect(readImageDimensions(pngHeader(1600, 2000))).toEqual({ width: 1600, height: 2000, format: "png" });
  });

  it("accepts a suitable 4:5 product photo", () => {
    const quality = inspectImageQuality(pngHeader(1600, 2000), "product");
    expect(quality.accepted).toBe(true);
    expect(quality.score).toBe("excellent");
    expect(quality.aspectRatio).toBe(0.8);
  });

  it("rejects a product image below the minimum resolution", () => {
    const quality = inspectImageQuality(pngHeader(320, 320), "product");
    expect(quality.accepted).toBe(false);
    expect(quality.score).toBe("rejected");
    expect(quality.messages[0]).toContain("صغيرة جداً");
  });

  it("keeps unusual but sufficiently large aspect ratios uploadable with a warning", () => {
    const quality = assessImageDimensions({ width: 1800, height: 700, format: "jpeg" }, "product");
    expect(quality.accepted).toBe(true);
    expect(quality.score).toBe("needs_attention");
    expect(quality.recommendations[0]).toContain("4:5");
  });
});
