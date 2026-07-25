# Next Hardening Phase Report — 12 يوليو 2026

## العناصر المغلقة من ملاحظات التدقيق المتبقية

### 1. API Error Handling

تمت إضافة:

```text
ApiError
AuthenticationError
ForbiddenError
```

إلى `lib/api.ts`.

- `handleApiError` يمرر `statusCode` الآمن من 4xx/5xx المعرف صراحة.
- generic internal errors تعود الآن برسالة fallback آمنة بدل كشف رسالة قاعدة البيانات أو stack details للعميل.
- `requireAuth` وsession-revoked/account-disabled/platform-locked تستخدم statuses مناسبة: 401 / 403 / 503.
- rate limit errors الحاملة لـ `statusCode=429` تمرر الآن بشكل صحيح.

### 2. Password Policy & MFA

- `strongPasswordSchema`:
  - 12 حرفاً على الأقل.
  - حد أقصى 128.
  - منع fragments الشائعة مثل password/admin/demo/test/123456.
  - 3 أنواع أحرف على الأقل إذا كان الطول أقل من 16.
  - يسمح passphrase طويل 16+ حرفاً.
- التسجيل، reset password، change password تستخدم السياسة نفسها.
- MFA verify rate-limited: 10 محاولات لكل IP / 15 دقيقة.
- MFA disable يتطلب password + TOTP حالي، مع rate limit، ويكتب audit event.
- MFA enable/login verification يكتب security audit events.

### 3. CSP Hardening

في production، لم يعد middleware يمنح `img-src https:` و`connect-src https: wss:` بشكل عام.

الـ CSP يعتمد الآن على:

```env
NEXT_IMAGE_REMOTE_HOSTS=
CSP_IMG_SRC=
CSP_CONNECT_SRC=
```

ويضيف Sentry DSN origin تلقائياً عند ضبطه.

يبقى التطوير أوسع لتجنب كسر أدوات التطوير؛ في الإنتاج يجب ضبط allowlists صراحة قبل الإطلاق.

### 4. Restore Governance

أي restore من لوحة الإدارة يحتاج:

1. عبارة مطابقة:
   ```text
   RESTORE <backup-file-name>
   ```
2. Safety backup قبل truncate/restore.
3. في production:
   ```env
   BACKUP_RESTORE_MAINTENANCE_MODE=true
   BACKUP_RESTORE_APPROVAL_TOKEN=<independent-secret>
   ```
4. Audit event يحتوي restore result وsafety backup metadata.

### 5. Repository Hygiene

- أزيل `.sudo_as_admin_successful`.
- أضيف `.nvmrc` = Node 20.
- `package.json` صار يحدد:
  ```json
  "engines": { "node": ">=20 <23", "npm": ">=10" }
  ```
- تم تحديث lockfile metadata.

## Validation

| Check | Result |
|---|---|
| ESLint | passed |
| TypeScript strict | passed |
| Unit tests | 17 files / 46 tests passed |
| Migration parity | 50 SQL / 50 journal entries |
| Drizzle check | passed |
| Secret scan | passed |
| npm audit production dependencies | 0 vulnerabilities |
| git diff --check | passed |

## Remaining non-code / operator work

- Configure CSP allowlist values according to real CDN/Sentry/browser integrations.
- Configure real Sentry, pooler, S3/R2, Redis, Grafana/Prometheus, Google OAuth and ERP credentials.
- Execute backup recovery drill, staging E2E and load tests.
- Choose repository license and enable GitHub branch protections / security settings.
