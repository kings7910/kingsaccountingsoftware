# Work status

Updated September 8, 2026.

## Operational accounting build — September 8, 2026

Built an Accounting posting queue for approved fuel, completed maintenance, and delivered loads. Fuel/maintenance can become paid expenses or unpaid vendor bills; delivered loads become issued ledger-backed invoices including fuel surcharge. Source row locks, immutable accounting links, tenant foreign keys, RLS and finance-only RPCs prevent duplicate posting and protect billing details. Source modules show accounting linkage and hide editing. Existing expense, bill and invoice corrections remain available.

Migration `20260908222741_operational_accounting.sql` was generated from the locally tested schema, reviewed to retain the pg_net extension, and supplemented with explicit table/function permissions. Local TypeScript, lint, 213 unit tests and 341 database assertions pass (304 prior checks plus 37 operational checks). Security/performance advisors are clean. All ten browser workflows pass (nine existing workflows, followed by the new operational workflow after fixing one-to-one link display). The new browser test verifies paid fuel, an unpaid maintenance bill, a delivered-load invoice, locked source controls and simultaneous posting retries. The production build passes and its accounting screenshot was reviewed. Production release is in progress.

See [Operational accounting](OPERATIONAL_ACCOUNTING.md) for usage and limits. Historical manual-entry matching, POD/PDF/email workflows and external payment execution remain separate work.

## Internal accounting release live — September 8, 2026

Supabase CLI authentication was restored with the user's verification code. The production dry run identified exactly the three pending migrations: `20260908212301`, `20260908213200`, and `20260908213538`. All three were applied to `uxrssvjdbumclzintnri` and verified in hosted migration history. Preflight counts showed no companies, income, expenses or settlements. Hosted checks confirm all three journal links, row-level security on customer corrections, and authenticated-only execution for the six public accounting functions. Security/performance advisors report no issues.

Source commit `9ab59f6` is now live as Vercel production deployment `dpl_Cbeb8gpQVR864NDUVVhyCf8quHdC`. Promotion succeeded, and `https://kings-accounting-software-two.vercel.app` resolves to this deployment with READY status. The live health endpoint confirmed database and authentication readiness at 22:02 UTC; AI remains unconfigured. The deployment-specific error-log scan found no logs. No hosted users or business records were created by release verification.

Pre-release validation remains 213 unit tests, 304 database checks, nine browser workflows, lint, TypeScript and production build. The preparation and access-blocker entries below are historical and resolved. Remaining product scope is still listed below; this release does not connect external providers or implement legacy invoice adoption.

## Internal accounting release preparation — September 8, 2026

Recovered the unfinished local database changes into migration `20260908212301_complete_internal_accounting.sql`. The generated diff was reviewed to remove unrelated extension removal and preserve explicit function privileges. General paid income/expenses and paid settlements now post balanced journals, lock their sources, and support separate reversals. Request IDs protect transaction and settlement save retries. Account administration protects used account numbers/types; accounting-period closure serializes with posting and rejects draft journals.

Customer payment reversals and credit-balance refunds have immutable dated allocations and journals, limits enforced under an invoice lock, and retry protection. The invoice interface exposes corrections and their history; dashboard and A/R reporting include their dated effect. Operational list readers continue past API caps. Reports and journal history retrieve journal lines independently to avoid nested relation truncation. New invoice due dates use the company's payment terms; settings identify preferences that do not yet drive application behavior.

Browser verification exposed an empty account selector for newly created companies. Migration `20260908213538_initialize_company_accounts.sql` initializes standard accounts during onboarding and adds missing account definitions for existing companies without changing balances or existing accounts. Migration `20260908213200_audit_accounting_administration.sql` audits account/period administration and customer corrections.

Validation passes under Node 22: lint, TypeScript, production build, 213 unit tests across 34 files, 304 database tests across 22 files, and all nine browser workflows. The main accounting migration passes a clean local rebuild; database function lint and security/performance advisors report no issues. Browser tests verify account creation, period closure/reopening, paid expense posting, source reversal, invoice payment reversal and dashboard/A/R reconciliation. The final complete browser run passed in 49.3 seconds. Login and dashboard screenshots were reviewed.

Production database access is currently unavailable: the CLI has no Supabase access token and the connected Supabase app denies access. The user has been asked to reconnect. Do not promote this application build until all three new migrations are applied to `uxrssvjdbumclzintnri`. The two earlier September 8 migrations are already recorded as deployed above.

Source commit `9ab59f6` is pushed to `origin/codex/complete-core-workflows`. Vercel deployment `dpl_Cbeb8gpQVR864NDUVVhyCf8quHdC` is READY at `https://kings-accounting-software-dwa8anypj-kings-9bed.vercel.app`, built with production configuration and `--skip-domain`. Its health endpoint confirms database/authentication connectivity at 21:43 UTC; this does not verify the pending schema or hosted business workflows. Its error-log scan returned no logs. The live domain still resolves to `dpl_ABz4Bq8E6iVhiHgFr1o7hWGU2prZ`. No production migration or promotion was performed.

To resume release: restore Supabase CLI/app authentication, verify hosted migration history, apply only pending migrations `20260908212301`, `20260908213200`, and `20260908213538`, run hosted schema/advisor checks, then promote the staged deployment and verify the live domain. Existing source changes require no further application rebuild unless code or environment configuration changes.

Remaining scope: guided legacy-invoice adoption/reconciliation, operational expense links between fuel/maintenance records and accounting entries, broader application use of saved settings, and provider-dependent services. Historical transactions and settlements are not automatically posted. Operational cost reports remain separate from posted ledger financial statements.

## Dashboard reporting backend — September 8, 2026

The next backend increment connects dashboard financial totals and six-month charts to posted journal lines. It shares the financial-report calculation rules, excludes future dates, and compares month-to-date values with the previous full month. Outstanding receivables subtract dated payments and credits, exclude drafts, and count invoices with remaining balances; customer credit balances do not offset another customer's unpaid invoice.

A shared ID-cursor reader retrieves complete dashboard aggregate inputs even when the API row cap is below the requested page size. Journal lines and invoice allocations are paged independently to avoid nested relation truncation. Reads remain company-scoped and subject to row-level security. Authentication and active membership are checked before querying; drivers cannot invoke the office dashboard. Any failed page fails the entire response rather than displaying partial totals.

Fleet ratios use this month's posted income/expenses and approved/posted mileage. Fuel is displayed separately and is not added again to ledger expenses. The recent-transaction and active-load cards remain deliberately limited lists and do not feed the financial totals. Interface copy explains the ledger basis, role visibility, and date comparison.

Validation: lint, TypeScript and 210 unit tests across 33 files pass, including regression cases for drafts, future dates, partial allocations, credit balances, 1,201 lines behind a 100-row API cap, failed pages and driver access. Production build and all eight browser workflows pass. The authenticated invoice test verifies $900 posted revenue and $500 outstanding after issuing a $1,000 invoice, recording a $400 payment and a $100 credit. After the final query-factory improvement, the seven targeted unit checks, lint, production build and invoice/dashboard browser workflow pass again. Browser inspection confirms the login and demo screens render without page errors; the authenticated dashboard screenshot was reviewed. This increment is local; the preceding integrity/receivables release remains the live deployment. No new database migration is required. General transaction/settlement posting, account/period administration and broader operational workflows remain separate work.

## Production integrity and receivables release — September 8, 2026

Supabase CLI login was authorized by the user and production access restored. Both reviewed migrations (`20260908195316` and `20260908200539`) were applied to `uxrssvjdbumclzintnri` and verified in hosted migration history. Hosted invoice/payment tables were empty before deployment. Schema checks confirm the invoice ledger column, paid-settlement trigger, and payment/credit RPCs. Security and performance advisors report no warnings or errors.

Vercel production deployment `dpl_ABz4Bq8E6iVhiHgFr1o7hWGU2prZ` built successfully and was promoted. The live domain `https://kings-accounting-software-two.vercel.app` resolves to this deployment with READY status. Its health endpoint reports database and authentication ready at 20:48 UTC. AI remains unconfigured. Local validation below covers the authenticated workflows; no hosted business records were created by release verification.

## Local integrity and receivables build — September 8, 2026

Paid driver settlements now reject edits, reopening and deletion at the database boundary, including direct table writes. Shared payroll-period dates cannot be changed or deleted after payment. Paid rows no longer offer edit/delete controls. Real company settings use blank identity defaults, retain sample identity only in demo mode, and prevent saving after a failed initial read. Email preference controls disclose that delivery is not connected.

Newly issued invoices post balanced receivables, freight revenue and sales-tax journals. Invoice headers and lines lock after issuance. Finance users can record dated partial customer payments against an existing cash/asset account, issue dated credit notes with proportional tax reversal, and inspect allocation/journal history. Customer credits after payment remain visible as credit balances. Stable request IDs prevent duplicate invoice creation, payments and credits after lost responses; changed retry payloads are rejected. Invoice-linked journals cannot be reversed independently of the subledger. A/R aging now includes customer credits, account 1100, and the reconciliation difference. Invoice browsing supports 50-record cursor pages with explicit loaded-record search scope.

All pre-existing invoices are marked as legacy and remain read-only; no historical invoices or payments are automatically posted. Reconcile existing manual journals before introducing a guided legacy adoption workflow. Customer-payment reversals/refunds, a settlement-correction interface, ledger posting for general transactions/settlements, dashboard calculation corrections, broader settings integration and pagination outside invoices remain open. Invoice issuance does not send email or transfer money.

Validation under Node 22.22.1: lint, TypeScript, 203 unit tests across 31 files, production build, and all eight browser workflows pass. The local database suite passes 270 checks across 21 files; function lint and security/performance advisors report no issues. The new browser workflow checks blank real-company identity fields, invoice issuance, partial payment, credit, A/R reconciliation, concurrent identical payment retries, and a 390px layout. A separate local concurrency check confirms that two distinct 700 payments against a 1,000 invoice serialize: exactly one persists and the overpayment is rejected. The initial new browser test used an incorrect exact-label selector for the status select; the corrected accessible-role selector passes in the complete final run.

Deployment status: **deployed to production** as recorded above. Both migrations are applied locally and to the hosted database. Their reviewed files preserve explicit function grants and contain no unrelated extension removal from schema-diff output. Invoice clients now use the dated-payment flow. Hosted email delivery and restore readiness remain unverified.

## Audit history pagination and export recovery — September 8, 2026

Audit history now loads in batches of 250, with a timestamp-and-ID cursor so older events remain accessible beyond the previous 1,000-event limit. Cursor timestamps preserve database precision and every page rechecks active membership and audit permissions. The interface shows loaded and matching counts and explains that search and CSV export cover loaded events. Failed reads offer retry controls, failed later pages preserve existing history, and exports are blocked during loading, after errors, or when no events match. Company changes discard the previous company's display and ignore outstanding requests. CSV exports neutralize spreadsheet formulas in user-entered fields and quote carriage returns.

Validation: 193 unit tests, TypeScript, lint, and a production build pass. An isolated local browser workflow verifies 510 same-timestamp events across three pages, oldest-event search, filtered CSV download, and a 390px layout without horizontal overflow. Browser visual checks show the audit screen loads without page errors. No database schema changes are required for this release.

## Replacement Supabase project — September 8, 2026

Created `kings-accounting-software` (`uxrssvjdbumclzintnri`) in `onevillageshipping@gmail.com's Org` (`dpmndtdjnkojgcrrpexl`) on its Free plan in `us-east-1`. This is a fresh database, not a restore of the previous hosted project's records.

All 25 repository migrations were applied and verified. The database has 48 public tables, all with row-level security enabled, and zero auth users. Security and performance advisors returned no warnings or errors. The authentication health endpoint returned HTTP 200.

The local Supabase CLI link and ignored `.env.local` now target this project. Credentials are excluded from Git. Vercel production is connected to this replacement database. Its environment variables and Supabase sign-in redirects were updated, and deployment `dpl_3zMvsZ7KaoiQhGF4KYigm798tsjE` passed live database and authentication checks before promotion. Earlier hosted release entries below describe the previous project and deployment.

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

- The server-only SUPABASE_SERVICE_ROLE_KEY is now configured in Vercel for team invitations. Hosted invitation email delivery remains unverified. AI still requires OPENAI_API_KEY; credentials must never be committed or exposed in client variables.
- Live bank feeds, payment processing, receipt OCR and automatic payroll tax filing require separate integrations. Manual bank CSV import and reconciliation work without a feed provider.
- Production email delivery, recovery redirects, backups and a restore rehearsal must be verified before real financial records are onboarded.
- Browser tests use isolated local accounts. Hosted email delivery and third-party integrations are not covered by those tests.

## Migration history

The original hosted baseline SQL matches the repository baseline. New hosted migrations receive timestamps from Supabase MCP; repository filenames are aligned to those assigned timestamps. Hosted migration history is preserved without rewriting it.

## Hosted release state

All 25 repository migrations are applied to hosted Supabase project `mwguntuwtzrxmtudejhn`, including A/P ledger posting, unpaid-bill reversals, vendor credit/debit adjustments, bank statement reconciliation, and its foreign-key indexes. Hosted security and performance advisors report no warnings or errors; informational notices remain for private deny-by-default storage, older foreign-key indexes and newly unused indexes. No hosted users or business records were created by release testing.

The release branch is published through GitHub pull request 1. Recovery and redirect-hardening commit `98f393b` is deployed as Vercel production deployment `dpl_8utKPYdjhVEhpLkkxcN58NqxyJG8` at `https://kings-accounting-software-two.vercel.app`; its live application returns HTTP 200 and its health endpoint reports database and authentication ready. Deployment Protection currently requires Vercel authentication to access the application. Team invitations and AI remain disabled until their server-only keys are configured.

Post-deployment verification on September 7 confirms Vercel READY status, successful production promotion, live database and authentication health, and the new 404 response. The deployment-specific error-log scan returned no logs. The AI health flag remains false.
