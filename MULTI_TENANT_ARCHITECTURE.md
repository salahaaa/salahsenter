# SaaS Multi-Tenant Architecture

## Goal
Enable the marketplace to evolve into a SaaS platform where each tenant can operate an independent storefront with custom domain, theme, billing and white-label settings.

## Tables
```txt
tenants
tenant_users
tenant_stores
tenant_domains
tenant_settings
tenant_themes
tenant_billing
```

## Plans
```txt
Starter
Professional
Business
Enterprise
```

## Isolation Model
Current foundation:
- Tenant identity and plan are separate from marketplace stores.
- Tenant users provide access scope.
- Tenant stores map existing stores to tenants.
- Tenant settings/themes/domains are isolated by tenant id.

Future hardening:
- Add `tenant_id` to high-volume domain tables after migration freeze.
- Enforce tenant context in repositories.
- Add row-level policies if PostgreSQL RLS is adopted.

## Routes
```txt
/admin/tenants
/api/admin/tenants
```

## Clean Architecture Direction
- Domain services under `lib/enterprise/*`.
- Existing DB remains source of truth.
- New tenant-aware repository layer should wrap direct table access for future modules.
