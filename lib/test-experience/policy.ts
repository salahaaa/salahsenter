export const TEST_EXPERIENCE_CONFIRMATION = "CREATE_TEST_EXPERIENCE";

export function isProductionLikeEnvironment(env: Record<string, string | undefined> = process.env) {
  return env.APP_ENV === "production" || env.NEXT_PUBLIC_APP_ENV === "production" || env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

export function assertTestExperienceEnvironment(env: Record<string, string | undefined> = process.env) {
  if (isProductionLikeEnvironment(env)) throw new Error("Test Experience Bootstrap محظور تماماً في Production.");
  if (env.TEST_EXPERIENCE_CONFIRM !== TEST_EXPERIENCE_CONFIRMATION) {
    throw new Error(`عيّن TEST_EXPERIENCE_CONFIRM=${TEST_EXPERIENCE_CONFIRMATION} لتأكيد إنشاء بيانات اختبار Local/Staging.`);
  }
}

export function normalizeTestExperienceSlug(value: string, variableName: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,120}$/.test(slug)) throw new Error(`${variableName} يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً وشرطة فقط.`);
  return slug;
}

export function assertTestExperiencePassword(value: string, variableName: string) {
  if (value.length < 16) throw new Error(`${variableName} يجب أن يكون 16 حرفاً على الأقل.`);
  if (/demo|example|change.?me|replace|password123/i.test(value)) throw new Error(`${variableName} يبدو كلمة مرور افتراضية أو غير آمنة.`);
  return value;
}
