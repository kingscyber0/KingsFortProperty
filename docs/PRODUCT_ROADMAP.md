# Product roadmap and acceptance gates

## Product direction
Windows desktop client, multi-tenant hosted service, monthly company subscription, per-user logins and centrally shared company records. Offline capability is a planned resilience feature, not a claim that records currently synchronise offline.

## Delivery phases
1. Foundation: Electron shell, design system, company registration, authentication, tenant isolation, roles, audit events.
2. Company operations: invitations, HR/staff directory, settings, onboarding and help centre.
3. Property: register, owners, approvals, uploads, price/status histories, availability review and search.
4. Customer pipeline: enquiries/leads, matching, follow-ups, inspections, no-show recovery and sales pipeline.
5. Tenancy and finance: tenant profiles, leases, rent schedules, payment allocations, arrears, reminders and reconciliations.
6. Communication: email templates, WhatsApp provider, opt-in/consent, delivery logs, retries and notification preferences.
7. Subscription and SaaS administration: monthly plans, Paystack checkout, verified webhooks, grace period, cancellation, renewals and company billing portal.
8. Reports and reliability: dashboards, Excel/PDF exports, backups, restore drills, monitoring, audit review and support tooling.
9. Offline and release: encrypted local cache, queued writes, conflict resolution, app updates, signed Windows installer, upgrade/uninstall testing.

## Required release gates
- Tenant-isolation tests across every endpoint and background job.
- Role permission tests including direct API calls, not only UI visibility.
- Password reset, account recovery, invitation expiry/replay and session revocation tests.
- Payment webhook signature verification and duplicate-event idempotency.
- Data backup and verified restore test.
- End-to-end workflows for lead → property match → inspection → negotiation/sale and property → tenant → rent due → payment.
- Notification consent, delivery failure, retries and audit logs.
- Windows installer, update, uninstall and clean-machine tests.
