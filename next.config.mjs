import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const imageHostnames = (process.env.NEXT_IMAGE_REMOTE_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" }
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
}

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: imageHostnames.map((hostname) => ({ protocol: "https", hostname })),
    formats: ["image/avif", "image/webp"]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

const sentryOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true
};

export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN ? withSentryConfig(nextConfig, sentryOptions) : nextConfig;
