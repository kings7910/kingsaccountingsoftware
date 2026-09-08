# Backend release checklist

Authorized scope: continue fixing the backend and push the verified release live.

- [x] General income/expense ledger posting, source locks, reversals and retry protection.
- [x] Driver settlement ledger posting, corrections and retry protection.
- [x] Company chart of accounts, onboarding account initialization and accounting-period administration.
- [x] Invoice payment-term defaults and disclosure of unsupported saved preferences.
- [x] Paging for operational lists, reports, journal history and bank history.
- [x] Customer payment reversals/refunds and their effect on dashboard/A/R reporting.
- [x] Account/period/correction audit records and database security checks.
- [x] Final application/browser verification: lint, TypeScript, build, 213 unit tests, 304 database tests and nine browser workflows.
- [x] Push source (`9ab59f6`) and stage Vercel build (`dpl_Cbeb8gpQVR864NDUVVhyCf8quHdC`, READY).
- [x] Apply three pending production migrations, promote the staged build, and verify live health (22:02 UTC, September 8).

Supabase CLI access was restored. All three migrations are applied to production, and deployment `dpl_Cbeb8gpQVR864NDUVVhyCf8quHdC` is live at https://kings-accounting-software-two.vercel.app. Database/authentication health passes; hosted advisors report no issues and the deployment error scan found no logs.

Remaining product scope: guided legacy invoice reconciliation/adoption, historical operational-cost matching, POD/PDF/email workflows, and wider use of saved company preferences. External bank feeds, payment execution, tax filing, OCR and email delivery require separately configured providers.

## Operational posting increment

- [x] Fuel/maintenance expense or bill posting and source locks.
- [x] Delivered-load invoice posting and protected billing details.
- [x] Accounting queue and source-module linkage visibility.
- [x] Retry, authorization, closed-period, audit and direct-write database tests.
- [x] TypeScript, lint, 213 unit tests, 341 database assertions and clean advisors.
- [x] All ten browser workflows, including concurrent posting requests, and production build.
- [ ] Push source, apply the reviewed migration, deploy and verify live health.
