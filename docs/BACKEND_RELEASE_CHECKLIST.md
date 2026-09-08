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
- [ ] Apply production migrations, deploy, and verify live health.

Production Supabase access must be restored before applying migrations or promoting the application. CLI access has no token; the connected app denies access. Vercel and GitHub access are available.

Remaining product scope: guided legacy invoice reconciliation/adoption, operational cost links to prevent duplicate manual accounting, and wider use of saved company preferences. External bank feeds, payment execution, tax filing, OCR and email delivery require separately configured providers.
