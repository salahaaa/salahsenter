export type ImageQualityProfile = "general" | "product" | "category" | "banner";

export type ImageDimensions = {
  width: number;
  height: number;
  format: "jpeg" | "png" | "gif" | "webp" | "unknown";
};

export type ImageQualityAssessment = {
  profile: ImageQualityProfile;
  width: number | null;
  height: number | null;
  format: ImageDimensions["format"];
  aspectRatio: number | null;
  megapixels: number | null;
  score: "excellent" | "good" | "needs_attention" | "rejected" | "unknown";
  accepted: boolean;
  messages: string[];
  recommendations: string[];
};

export class ImageQualityError extends Error {
  readonly statusCode = 422;
  readonly assessment: ImageQualityAssessment;
  constructor(assessment: ImageQualityAssessment) {
    super(assessment.messages[0] || "جودة الصورة لا تحقق الحد الأدنى المطلوب");
    this.name = "ImageQualityError";
    this.assessment = assessment;
  }
}

const profiles: Record<ImageQualityProfile, { minWidth: number; minHeight: number; recommendedLongSide: number; minAspect: number; maxAspect: number; label: string }> = {
  general: { minWidth: 1, minHeight: 1, recommendedLongSide: 1000, minAspect: 0.35, maxAspect: 3, label: "الصورة" },
  // 4:5 is the preferred storefront card frame; broad limits still accept common product photography.
  product: { minWidth: 640, minHeight: 640, recommendedLongSide: 1400, minAspect: 0.55, maxAspect: 1.8, label: "صورة المنتج" },
  category: { minWidth: 480, minHeight: 480, recommendedLongSide: 1000, minAspect: 0.55, maxAspect: 1.8, label: "صورة القسم" },
  banner: { minWidth: 1200, minHeight: 500, recommendedLongSide: 1920, minAspect: 1.5, maxAspect: 4, label: "صورة البانر" }
};

function readU16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32BE(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])) >>> 0;
}

function detectJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = readU16BE(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    // Start Of Frame markers carrying width/height, except lossless/differential exclusions are harmless here.
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: readU16BE(bytes, offset + 5), height: readU16BE(bytes, offset + 3), format: "jpeg" };
    }
    offset += length;
  }
  return null;
}

function detectWebp(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP") return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    return { width: 1 + readU24LE(bytes, 24), height: 1 + readU24LE(bytes, 27), format: "webp" };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    return { width: readU16LE(bytes, 26) & 0x3fff, height: readU16LE(bytes, 28) & 0x3fff, format: "webp" };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, format: "webp" };
  }
  return null;
}

/** Extracts dimensions without decoding full pixels or depending on a native image library. */
export function readImageDimensions(input: Uint8Array): ImageDimensions | null {
  const bytes = input;
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20), format: "png" };
  }
  if (bytes.length >= 10 && (String.fromCharCode(...bytes.subarray(0, 6)) === "GIF87a" || String.fromCharCode(...bytes.subarray(0, 6)) === "GIF89a")) {
    return { width: readU16LE(bytes, 6), height: readU16LE(bytes, 8), format: "gif" };
  }
  return detectJpeg(bytes) || detectWebp(bytes);
}

export function assessImageDimensions(dimensions: ImageDimensions | null, profile: ImageQualityProfile = "general"): ImageQualityAssessment {
  const rules = profiles[profile];
  if (!dimensions || !dimensions.width || !dimensions.height) {
    return {
      profile,
      width: null,
      height: null,
      format: "unknown",
      aspectRatio: null,
      megapixels: null,
      score: "unknown",
      accepted: profile === "general",
      messages: profile === "general" ? ["تعذر قراءة أبعاد الصورة؛ تم حفظها مع توصية بمراجعتها قبل النشر."] : [`تعذر قراءة أبعاد ${rules.label}. استخدم JPG أو PNG أو WEBP صالحاً.`],
      recommendations: ["استخدم صورة JPG أو PNG أو WEBP واضحة، ويفضل رفعها من جهازك بدلاً من رابط غير معروف."]
    };
  }

  const aspectRatio = Number((dimensions.width / dimensions.height).toFixed(3));
  const megapixels = Number(((dimensions.width * dimensions.height) / 1_000_000).toFixed(2));
  const shortSideTooSmall = dimensions.width < rules.minWidth || dimensions.height < rules.minHeight;
  const messages: string[] = [];
  const recommendations: string[] = [];

  if (shortSideTooSmall) {
    messages.push(`${rules.label} صغيرة جداً (${dimensions.width}×${dimensions.height}). الحد الأدنى هو ${rules.minWidth}×${rules.minHeight}px.`);
    recommendations.push(`ارفع صورة أوضح بدقة ${rules.recommendedLongSide}px أو أعلى على الضلع الطويل.`);
  }
  if (aspectRatio < rules.minAspect || aspectRatio > rules.maxAspect) {
    messages.push(`نسبة أبعاد الصورة (${aspectRatio}:1) غير مناسبة غالباً لـ ${rules.label}.`);
    recommendations.push(profile === "product" ? "للبطاقات الاحترافية استخدم صورة قريبة من 4:5 أو 1:1 مع المنتج في المنتصف." : "راجع نسبة أبعاد الصورة قبل النشر لتجنب فراغات أو قص غير مرغوب." );
  }
  const longSide = Math.max(dimensions.width, dimensions.height);
  if (longSide < rules.recommendedLongSide) {
    recommendations.push(`الدقة مقبولة، لكن ${rules.recommendedLongSide}px أو أعلى على الضلع الطويل ستعطي عرضاً أفضل على شاشات الجوال.`);
  }

  const accepted = !shortSideTooSmall;
  const score = !accepted ? "rejected" : messages.length ? "needs_attention" : longSide >= rules.recommendedLongSide ? "excellent" : "good";
  return { profile, width: dimensions.width, height: dimensions.height, format: dimensions.format, aspectRatio, megapixels, score, accepted, messages, recommendations };
}

export function inspectImageQuality(buffer: Uint8Array, profile: ImageQualityProfile = "general") {
  return assessImageDimensions(readImageDimensions(buffer), profile);
}

export function assertImageQuality(buffer: Uint8Array, profile: ImageQualityProfile = "general") {
  const assessment = inspectImageQuality(buffer, profile);
  if (!assessment.accepted) throw new ImageQualityError(assessment);
  return assessment;
}
