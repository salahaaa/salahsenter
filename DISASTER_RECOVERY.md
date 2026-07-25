# Disaster Recovery

## Objectives
- RPO: 24 hours for standard deployment, lower if managed PostgreSQL PITR is enabled.
- RTO: 4 hours for application restore after infrastructure failure.

## Recovery Steps
1. Freeze writes if data integrity is uncertain.
2. Restore PostgreSQL from latest verified backup/PITR point.
3. Re-run migrations with `npm run db:migrate`.
4. Restore media bucket/local uploads from object storage backup.
5. Rotate compromised secrets if incident is security related.
6. Validate `/api/health` and `/api/admin/debug/database`.
7. Run smoke tests for login, store browsing, product, order, admin and merchant panels.

## Incident Checklist
- Preserve logs.
- Export audit logs/security alerts.
- Identify blast radius.
- Rotate JWT_SECRET only after forcing logout all sessions.
- Notify affected merchants/customers when required.
