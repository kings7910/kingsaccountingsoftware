# Work status

Updated September 8, 2026.

## Replacement Supabase project — September 8, 2026

Created `kings-accounting-software` (`uxrssvjdbumclzintnri`) in `onevillageshipping@gmail.com's Org` (`dpmndtdjnkojgcrrpexl`) on its Free plan in `us-east-1`. This is a fresh database, not a restore of the previous hosted project's records.

All 25 repository migrations were applied and verified. The database has 48 public tables, all with row-level security enabled, and zero auth users. Security and performance advisors returned no warnings or errors. The authentication health endpoint returned HTTP 200.

The local Supabase CLI link and ignored `.env.local` now target this project. Credentials are excluded from Git. Vercel still requires access to the production account before its environment variables can be updated and the app redeployed against this database. Earlier hosted release entries below describe the previous project and deployment.

## Workspace recovery and final application checks

Workspace and onboarding entry now distinguish failed profile or membership queries from a confirmed missing membership. Database failures show a retry screen instead of sending an existing user into company creation. The application error boundary uses the installed Next.js version’s `retry()` API to refetch the route, displays no raw error details, and reminds users to check financial submissions before repeating them. Unknown routes now show a responsive 404 page with workspace and demo links.

Email-confirmation redirects reject protocol-relative URLs, backslashes, and control characters that URL parsing could normalize into an external destination. Internal password-recovery and workspace links remain supported.

Node 22 verification passes lint, TypeScript, the final production build, 183 unit tests across 27 files, and 242 local SQL tests across 21 files. All six existing production-browser workflows pass against isolated local Supabase accounts. A separate 390px browser check confirms the new 404 page returns HTTP 404, has no horizontal overflow or page errors, and sends unsigned users to sign-in through its workspace link. These changes were deployed to production on September 7, 2026 as source commit `98f393b`. The production prerequisites below remain open.

## Implemented core workflows

The authenticated workspace now persists transactions, bank statement imports and reconciliations, invoices, vendor bills and payments, loads, fleet, fuel, maintenance, driver settlements, journals, approvals, settings, team roles and notifications. The driver portal supports offline submissions with server-side retry deduplication. Approvals update their linked source records atomically. Tenant references, active membership checks, posted-journal immutability, paid-invoice protections, vendor-payment immutability, and completed-reconciliation locks are enforced in the database.

Financial reports use posted ledger entries and dated receivable/payable allocations. Loading failures are visible and unavailable reports cannot be exported as stale or demonstration data. Marking an invoice paid records its outstanding balance as received that day. Vendor bills select an expense account, post bills against A/P account 2000, post each payment against a selected cash or bank account, and support dated partial payments. Immutable vendor credit/debit adjustments post separate journals, reopen balances when required, preserve overpayments as vendor credits, and reconcile historical A/P aging to the ledger. Unadjusted, unpaid posted bills can be voided through an atomic reversing journal.

Finance users can link checking or savings accounts to active asset ledger accounts and upload bank CSV files without retaining the source file. Imports accept Amount or Debit/Credit layouts, enforce a 1 MB and 1,000-row limit, and deduplicate stable statement rows. Review requires an exact signed amount match to a posted journal containing the linked bank ledger. A period can only be completed when every imported row is resolved and the statement closing balance equals the cumulative posted book balance; completion locks the reconciliation and its rows.

The visible workspace navigation now matches each role's server permissions. Dispatchers receive dispatch and approval controls; fleet managers receive fleet, fuel, maintenance and approval controls, including working vehicle creation and editing. Owner-only fleet deletion stays hidden for fleet managers. Financial and operational forms reject non-finite numeric values before calculations or persistence, and icon-only controls have accessible names. Dashboard month comparisons are calculated from current and prior-period records, and fleet cards no longer display hard-coded deltas or progress values.

## Release verification

- Node 22: lint, TypeScript and 157 unit tests across 25 files pass.
- A clean local database rebuild passes 242 SQL tests across 21 files.
- Database function lint and security/performance advisors report no findings.
- Production build and all six browser workflows pass: protected routing; public demo navigation, quick actions, forms, accessible controls and sign-in links; dispatcher and fleet-manager role controls; owner onboarding, live modules, journal posting, financial reporting and outage recovery; mobile driver offline fuel synchronization and office approval; bank CSV import, ledger matching, reconciliation and locking.
- CI now repeats application, database and browser verification.

## Offline recovery follow-up

Offline navigations now show a standalone recovery page with a retry control and guidance for queued driver submissions. The service worker caches only public offline assets, removes its older shell caches, and leaves account pages, API responses, and Server Component payloads uncached. Registration failures no longer cause unhandled promise rejections. Existing driver submission storage and synchronization are unchanged.

Local verification: 163 unit tests across 26 files, TypeScript, lint and the production build pass. Browser checks confirm the public demo loads without page errors, a 390px mobile offline page has no horizontal overflow, and retrying after the server returns reaches sign-in for the protected driver route. This follow-up is included in the September 7, 2026 production release.

## Remaining product and operational scope

- Team invitations require the server-only SUPABASE_SERVICE_ROLE_KEY in Vercel. AI requires OPENAI_API_KEY. Neither secret was configured at the release check; keys must never be pasted into source or client variables.
- Live bank feeds, payment processing, receipt OCR and automatic payroll tax filing require separate integrations. Manual bank CSV import and reconciliation work without a feed provider.
- Production email delivery, recovery redirects, backups and a restore rehearsal must be verified before real financial records are onboarded.
- Browser tests use isolated local accounts. Hosted email delivery and third-party integrations are not covered by those tests.

## Migration history

The original hosted baseline SQL matches the repository baseline. New hosted migrations receive timestamps from Supabase MCP; repository filenames are aligned to those assigned timestamps. Hosted migration history is preserved without rewriting it.

## Hosted release state

All 25 repository migrations are applied to hosted Supabase project `mwguntuwtzrxmtudejhn`, including A/P ledger posting, unpaid-bill reversals, vendor credit/debit adjustments, bank statement reconciliation, and its foreign-key indexes. Hosted security and performance advisors report no warnings or errors; informational notices remain for private deny-by-default storage, older foreign-key indexes and newly unused indexes. No hosted users or business records were created by release testing.

The release branch is published through GitHub pull request 1. Recovery and redirect-hardening commit `98f393b` is deployed as Vercel production deployment `dpl_8utKPYdjhVEhpLkkxcN58NqxyJG8` at `https://kings-accounting-software-two.vercel.app`; its live application returns HTTP 200 and its health endpoint reports database and authentication ready. Deployment Protection currently requires Vercel authentication to access the application. Team invitations and AI remain disabled until their server-only keys are configured.

Post-deployment verification on September 7 confirms Vercel READY status, successful production promotion, live database and authentication health, and the new 404 response. The deployment-specific error-log scan returned no logs. The AI health flag remains false.
