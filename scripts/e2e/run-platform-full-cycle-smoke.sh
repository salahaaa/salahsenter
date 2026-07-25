#!/usr/bin/env bash
set -euo pipefail
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
E2E_ALLOW_STAGING_WRITE=true npx tsx scripts/e2e/platform-full-cycle-smoke.ts
