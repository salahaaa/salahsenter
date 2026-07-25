const arabicMap: Record<string, string> = {
  أ: "a",
  إ: "i",
  آ: "a",
  ا: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "th",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "h",
  ء: "",
  ئ: "e",
  ؤ: "o"
};

export function slugify(value: string) {
  const normalized = value
    .trim()
    .split("")
    .map((char) => arabicMap[char] ?? char)
    .join("")
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 170);
}

export function uniqueSlug(base: string) {
  const slug = slugify(base) || "item";
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}
