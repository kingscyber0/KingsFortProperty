# Architecture decisions

- **Distribution:** Windows desktop installer first (Windows 10/11). macOS is not in the first release scope.
- **Commercial model:** monthly subscription per company workspace. The exact plan price, user limits, trial length and grace period are intentionally configurable and not hard-coded until commercial approval.
- **Shared data:** central PostgreSQL service so authorised staff on different laptops see the same company data. A desktop-only local database would not satisfy multi-user shared access.
- **Tenant isolation:** every company-owned record is scoped to companyId and all API queries are scoped from the authenticated session. PostgreSQL row-level security is a further hardening step before production.
- **Offline:** local encrypted cache and queued writes are planned; offline conflict handling must be designed and tested before claiming offline operation.
- **Payments:** Paystack is the proposed Nigerian subscription billing provider, subject to merchant account availability and approval. Webhook verification and idempotency are mandatory.
- **Branding:** product name and logo should be configurable by subscription workspace; the KingsFort label is development branding only.
