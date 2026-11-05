# KingsFortProperty Desktop SaaS — development foundation

This is the new Windows-first desktop product foundation, designed as a monthly subscription service for multiple independent real-estate companies. It is separate from the existing Apps Script project; the original workbook and Apps Script source remain preserved for business-logic migration and reference.

## Current milestone (0.1.0)
- Electron desktop shell with context isolation, sandboxed renderer and Node integration disabled.
- React login and company registration screens.
- Initial guided onboarding with a clear skip option and a Help & Instructions entry point.
- Company-scoped staff and roles model: Super Administrator, Manager, HR, Accountant, Property Agent and Viewer.
- API routes for company registration, login, current-user profile, staff invitations and invitation acceptance.
- Backend role-permission middleware, password hashing, login rate limiting, security headers and audit events.
- PostgreSQL/Prisma schema for companies, users, invitations, subscriptions, properties, leads, tenants, inspections, rent payments and audit logs.
- Monthly subscription record model and Paystack configuration placeholders. Live payment collection/webhooks are not connected yet.

## Not yet production-ready
This is a development foundation, not a complete or deployable commercial product. It has not yet been dependency-installed, compiled, run end-to-end, penetration-tested, connected to a production database, or packaged as a Windows installer. Email invitation delivery, password-reset flow, email verification, payment checkout/webhooks, module APIs/UI, offline sync, backup restoration, update delivery, monitoring and deployment are outstanding.

## Prerequisites
- Node.js 22 LTS recommended
- PostgreSQL 16+
- Windows 10/11 for installer testing

## Local setup
1. Copy `.env.example` to `.env` and set a strong random `JWT_ACCESS_SECRET` (at least 32 characters) and PostgreSQL connection string.
2. Install dependencies: `npm install`.
3. Generate Prisma client: `npm run db:generate`.
4. Create the database and apply migrations: `npm run db:migrate`.
5. Build shared types: `npm run build:shared`.
6. Run API: `npm run dev:api`.
7. Run desktop renderer in a second terminal: `npm run dev:desktop`.

Note: Electron main-process development launch wiring and production API packaging still need to be completed before the desktop app runs as a single installed product. The current renderer/API foundation is intentionally separated to support a hosted multi-company service and desktop client.

## Security and tenancy rules
- All business tables carry a companyId directly or through a company-owned parent.
- Every API query must scope by authenticated companyId; never trust a companyId supplied by the renderer.
- Staff role is assigned by an authorised company administrator, never self-selected during ordinary registration.
- Do not expose password hashes, invitation token hashes, payment secrets or JWT secrets to the renderer.
- Production invitation delivery must send one-time links by email. Development-only raw invitation tokens must not be exposed in production.
- Production subscription status must be updated only from verified payment-provider webhooks.
