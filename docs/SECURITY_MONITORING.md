# Security Monitoring Pipeline

## Automated controls

| Control | Implementation | Cadence |
|---|---|---|
| Dependency vulnerability scan | `npm run security:verify` / `npm audit --omit=dev` | every PR, push, weekly |
| Secret scan | `scripts/security/verify-no-secrets.mjs` over HEAD + full Git history | every PR, push, weekly |
| Static application analysis | GitHub CodeQL for JavaScript/TypeScript | every PR, push, weekly |
| Dependency change review | GitHub dependency-review-action | every PR |
| Dependency update monitoring | `.github/dependabot.yml` | weekly |

## Repository settings to enable

In GitHub → Settings → Code security and analysis, enable:

1. Dependabot alerts.
2. Dependabot security updates.
3. Secret scanning and push protection (if available for the repository plan).
4. Code scanning default setup / CodeQL alerts.
5. Notifications for security alerts to the security owner/team.

## Triage targets

- Critical: acknowledge and mitigate within 24 hours.
- High: within 72 hours.
- Moderate: next planned maintenance release.
- Secrets: revoke/rotate first, then remove from history if a real credential was committed.

The custom secret scanner is a defense-in-depth guard. It does not replace GitHub Secret Scanning or an organization-grade scanner such as Gitleaks in hosted CI.
