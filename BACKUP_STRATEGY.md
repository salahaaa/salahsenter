# Backup Strategy

## Database
- Use managed PostgreSQL automated backups.
- Enable Point-In-Time Recovery in production.
- Retain daily backups for 30 days minimum.
- Test restore monthly.

## Media
- Production media should be stored in S3/R2/Cloudinary.
- Enable bucket versioning where available.
- Do not rely on local filesystem for durable production media.

## Application
- Source of truth is GitHub.
- CI must pass before deploy.
- Never commit `.env` or credentials.

## Verification
After each backup restore test:
```bash
npm run db:migrate
npm run db:seed
npm run build
```
Then verify admin, merchant, storefront and uploads.
