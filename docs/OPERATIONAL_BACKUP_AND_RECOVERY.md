# Operational Backup & Recovery

## Automated backup

The daily cron route is:

```text
/api/cron/backups/run
```

It is registered in `vercel.json` for 06:00 UTC and protected by the existing cron authorization. It creates a full database JSON backup and can copy physical media files to the backup bucket.

## Production configuration

```env
BACKUP_STORAGE_PROVIDER=s3              # s3 | r2; local is rejected in production
BACKUP_S3_BUCKET=<private-backup-bucket>
BACKUP_S3_ENDPOINT=<optional-r2-or-s3-endpoint>
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=<least-privilege-key>
BACKUP_S3_SECRET_ACCESS_KEY=<secret>
BACKUP_S3_PREFIX=database
BACKUP_S3_KMS_KEY_ID=<optional-kms-key>

BACKUP_MEDIA_ENABLED=true
BACKUP_MEDIA_SOURCE_HOSTS=cdn.example.com,res.cloudinary.com
BACKUP_MEDIA_PREFIX=media
BACKUP_MEDIA_MAX_FILES=500
BACKUP_MEDIA_MAX_BYTES=26214400
```

Use a private bucket, encryption at rest, lifecycle retention rules, restricted IAM credentials, and separate backup credentials from application media credentials.

## Media behavior

- Database records are always included in the database backup.
- With `BACKUP_MEDIA_ENABLED=true`, actual media files are downloaded only from HTTPS hosts listed in `BACKUP_MEDIA_SOURCE_HOSTS`, checked against file/quantity limits, then copied into the backup target.
- Every media result is recorded in the backup manifest as `stored`, `skipped`, or `failed`.
- Configure source hosts explicitly; this prevents the backup job becoming an SSRF fetcher.

## Recovery drill

Never restore into production to test recovery. Create an isolated, migrated recovery database and set:

```env
RECOVERY_TEST_DATABASE_URL=<isolated-recovery-database-url>
RECOVERY_TEST_CONFIRM=true
BACKUP_FILE=<optional-specific-backup-file>
```

Then run:

```bash
npm run backup:recovery-test
```

The command refuses a target matching `DATABASE_URL`, truncates only the recovery database, restores the selected backup, and verifies row counts table-by-table. Retain the successful output as release evidence.

## Restore governance

A destructive restore now requires:

1. The exact confirmation phrase: `RESTORE <backup-file-name>`.
2. A fresh safety backup before any truncate/restore action.
3. In production, `BACKUP_RESTORE_MAINTENANCE_MODE=true`.
4. In production, a separate `BACKUP_RESTORE_APPROVAL_TOKEN` supplied by the operator.

This is a deliberate maintenance operation; use a recovery drill database for testing and preserve the resulting audit event.

## Manual backup

```bash
npm run backup:json
```

The API dashboard can also create/download/restore backups for users with `backups.manage`. The API returns metadata rather than the full sensitive backup payload.
