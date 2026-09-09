# Project review and next build priorities

Reviewed September 8, 2026 against source commit `13b364b`.

Implementation follow-up: the first local build now protects paid settlements and shared period dates, removes demo identity fallbacks from real settings, adds ledger-managed invoice issuance, dated partial payments and credit notes, adds A/R control-account reconciliation, and pages invoice history. The original findings below describe the reviewed baseline. See WORK_STATUS.md for validation and deployment status. A subsequent local backend build connects dashboard totals to posted journals and dated receivables, pages dashboard aggregate inputs, and corrects the fleet ratios. Other money-module posting, broader settings integration and pagination outside invoices/dashboard remain open.

The application has substantial working workflows. The next milestone should be financial integrity and completion of the existing workflows, beginning with paid-settlement protection and receivables posting. Adding more navigation modules would leave the main accounting gaps unresolved.

This review covers repository documentation, application routes and modules, server actions, database migrations, existing tests, and targeted local database reproductions. Hosted configuration, email delivery, backups, and external providers were not independently verified in this review. Historical deployment statements in WORK_STATUS.md are not fresh production verification.

## Highest-priority findings

### 1. Protect paid driver settlements — fix first

**Confirmed locally:** an owner can create a settlement with gross pay 6,000, mark it paid, then call `save_driver_settlement` again to change gross pay to 1 and status to draft. The returned database row has `status=draft` and `gross_pay=1.00`. The entire reproduction was rolled back.

The deletion function blocks deleting a paid settlement, but the save function does not reject changes to an already paid settlement. Reopening it also defeats that deletion restriction. Existing payroll SQL tests check deletion while paid, but do not check reopening or editing after payment.

Evidence: `supabase/migrations/20260905035100_save_driver_settlement_atomically.sql`, `src/app/actions/payroll.ts`, `supabase/tests/payroll_rpc.test.sql`.

**Build:** database-enforced immutability for paid settlement fields and status; a separate dated correction/reversal workflow; controls in the interface that reflect those rules. Test direct table writes as well as RPC calls, concurrent edits, and attempts to reopen then delete.

### 2. Connect receivables and other money workflows to the ledger

**Confirmed locally:** creating an invoice and marking it paid creates one customer payment and zero journal entries for the test company. The reproduction was rolled back. `save_invoice` records the remaining payment using `current_date`; it does not post revenue, receivables, tax, or cash journals.

Code review also shows that `save_transaction` and `save_driver_settlement` persist their own records without a ledger posting step. Fuel and maintenance records likewise need an explicit policy for becoming expenses or vendor bills, so entering the same cost in two modules does not duplicate it.

Financial statements read posted journals. Vendor bills, vendor payments, and vendor adjustments already have atomic ledger posting, but the other workflows do not have equivalent connections. A saved or paid operational record therefore does not necessarily appear in the financial statements or bank-matching candidates.

Evidence: `src/app/actions/reports.ts:12`, `supabase/migrations/20260905035349_paid_invoice_integrity.sql`, `supabase/migrations/20260905035259_atomic_transaction_save.sql`, `supabase/migrations/20260905035100_save_driver_settlement_atomically.sql`. Existing A/P implementation: `supabase/migrations/20260906001320_payable_ledger_posting.sql`.

**Build next:** invoice issuance posting, dated partial customer payments with bank/account selection, customer credit notes and corrections, and A/R-to-ledger reconciliation. Then implement posting for general income/expenses and driver settlements. Require atomic writes, unique source links, safe retries, closed-period checks, and reversal-based corrections. Plan an explicit reconciliation/migration of existing records so historical manual journals are not duplicated.

**Acceptance:** an invoice, partial payment, final payment, and credit each change the appropriate ledger balances exactly once; A/R aging agrees with its control account; bank deposits are matchable; posting failure leaves no partial financial record.

### 3. Make dashboard numbers agree with their stated basis

`loadDashboard` totals income and expense rows without filtering their status; its current-month filter has no upper date boundary. Outstanding invoices sum full invoice totals without deducting payment/credit allocations and include every non-paid status. Fleet revenue/pay calculations use the five most recent active loads while dividing by this month's mileage. These bases can produce misleading comparisons even when every query succeeds.

Evidence: `src/app/actions/dashboard.ts:10` through its calculations and return value. Financial reports use different sources in `src/app/actions/reports.ts`.

**Build:** shared reporting rules for date ranges, approved/posted status, remaining receivables, and consistent operational periods. Use ledger-backed financial totals or clearly identify operational estimates. Add scenarios with draft records, future-dated records, partial payments, and more than five loads.

### 4. Finish company settings and accounting administration

Settings save invoice/load prefixes, payment terms, fiscal-year start, mileage rate, approval threshold, and email preferences. Repository references for these settings are confined to settings types, validation, persistence, and the settings interface; the relevant workflows do not consume them. Invoice labels still use `INV-`, and report periods follow calendar dates. The interface says the defaults affect new records and email choices generate administrative email, which overstates the implemented behavior.

`loadCompanySettings` also merges production company settings with demo defaults, including a sample EIN and DOT number when real values are absent. New companies should show blank identity fields instead.

The journal account options come from a static list in `src/lib/accounting.ts`. There is no company chart-of-accounts management or period-close interface, although database tables and closed-period posting guards exist.

Evidence: `src/lib/settings.ts`, `src/app/actions/settings.ts`, `src/components/settings/settings-workspace.tsx`, `src/lib/accounting.ts`, `src/lib/financial-reports.ts`.

**Build:** separate demo and production defaults, wire supported settings into creation/reporting, identify inactive preferences honestly, load account choices from the company database, and add account management plus controlled period closing. Email preferences need a real sender, scheduling, delivery records, and retry handling before they promise delivery.

### 5. Remove record-count ceilings from daily workflows

Most list actions perform a single query without pagination: transactions, invoices, loads, fleet, fuel, maintenance, settlements, journals, payables, approvals, and team. Their results can be capped by the API's configured row limit. Dashboard aggregate inputs also use single queries.

Bank reconciliation explicitly retrieves only the latest 1,000 imported rows and 1,000 journals across the company, plus 24 reconciliations and 12 imports. There is no paging path for older matching candidates or statement rows. Older work can become inaccessible in the interface even though the database retains it. Audit history already implements cursor pagination, and financial reports page their top-level queries.

Evidence: `src/app/actions/banking.ts:10`, the `list*` functions in `src/app/actions`, and `src/app/actions/audit.ts` for the existing pattern.

**Build:** server-side search/filtering and stable pagination, account/period-scoped bank queries, database-backed totals, and explicit export scope. Verify with more than 1,000 records, including an older unresolved bank statement.

## Module inventory and remaining work

| Area | Implemented | Remaining work |
| --- | --- | --- |
| Authentication and onboarding | Protected routes, company creation, recovery pages, role-based navigation | Verify hosted signup/invite/recovery delivery and access activation; explicit company selection if multi-company use is required |
| Transactions | Persisted income/expense creation and editing | Ledger posting, corrections, account/category allocation, pagination; module copy also promises splitting beyond the present form |
| Invoices | Items, totals, statuses, full-payment recording | Ledger-connected A/R, dated partial payments, credits/refunds, invoice document generation and actual sending |
| Bills and payables | Bills, partial payments, adjustments, reversals, ledger links, A/P reconciliation | Larger-data browsing and document attachments; external payment execution is separate |
| Banking | Manual CSV imports, duplicate protection, exact journal matching, locked reconciliations | Older-record access, split/combined matches and outstanding-item handling; live feeds later |
| Loads and routes | Load creation, customer/driver/truck assignment, status updates | Delivered-load-to-invoice flow, stronger document/POD workflow, richer stop/route planning |
| Fleet, fuel, maintenance | Vehicle, fuel, work-order persistence; driver mileage/fuel submission | Complete service-schedule/document management and explicit cost-to-accounting links |
| Payroll | Driver settlement calculation and saved payment status | Paid-record protection, dated corrections, ledger posting, pay statements; employee payroll/tax filing is not implemented |
| Accounting | Draft, posted and reversing journals; balance and closed-period guards | Company account management, period-close UI, opening-balance/import workflow, subledger integration |
| Reports and dashboard | Posted-ledger reports, aging, CSV export, operational summaries | Dashboard basis corrections; A/R reconciliation; transaction-level ledger drill-down; broader cash-account coverage |
| Approvals and audit | Atomic driver approvals; paginated audit history and filtered exports | Paging for approval backlog; expand regression tests to the confirmed cross-module gaps |
| Settings and notifications | Saved preferences, in-app notification reading | Apply preferences, remove demo identity fallbacks, implement email scheduling/delivery |
| Driver portal | Assigned trip data, retry-safe mileage/fuel queue, online receipt uploads | Cold offline app launch and offline receipt storage remain separate future scope |
| AI assistant | Server-side question/answer request with sign-in check | Configuration verification, active-company access enforcement, usage limits/timeouts; it has no company-record retrieval or action tools |

## Production prerequisites to verify before real use

- Confirm the intended Supabase project and deployed source revision. The status document records a replacement database that was created fresh, not restored from the old project.
- Verify hosted invitation delivery/acceptance, sign-in and password recovery with the correct redirects. This review did not send emails or create hosted users.
- Establish database **and document-storage** backups and demonstrate restoration into an isolated environment. The repository's environment backup is not evidence of a business-data restore.
- Verify monitoring, error visibility, and credential-dependent features in the hosted environment. Do not infer readiness from historical health checks.

Live bank feeds, payment processing, OCR and automatic payroll tax filing are later integrations. Their absence should not distract from the confirmed internal integrity gaps.

## Recommended delivery sequence

1. **Integrity patch:** lock paid settlements; add regression tests for reopening, editing and deletion; remove sample identity defaults from real company settings.
2. **Receivables completion:** ledger-connected invoice issuance, dated partial payments, credit notes, A/R reconciliation, and safe correction of existing records.
3. **Consistent books:** general transaction/settlement posting, explicit operational-cost links, dashboard corrections, and company account/period administration.
4. **Daily-use completion:** record pagination, working defaults, invoice documents/delivery, load-to-invoice flow, and driver pay statements.
5. **Production readiness and integrations:** complete hosted delivery/restore checks before real records; add external providers according to actual operational need.

## Verification from this review

- Local database suite: **242 tests across 21 files passed**.
- Targeted local reproductions confirmed the paid-settlement and missing-invoice-journal findings above; all inserted test business records were rolled back.
- Lint passed. TypeScript passed after the production build finished; an earlier overlapping build/typecheck run encountered disappearing generated `.next/types` files, so its result was discarded and the check rerun sequentially.
- Unit suite: **193 tests across 29 files passed**.
- Production build and **all seven browser workflows passed** against isolated local Supabase: unsigned routing; demo navigation; dispatcher/fleet permissions; owner onboarding, modules and reports; offline driver fuel/approval; bank import/reconciliation; audit pagination/export.
- Separate browser visual checks passed for the public demo dashboard and the sign-in page at 390px. The sign-in page had no horizontal overflow or framework error overlay; the browser reported no page errors. Authenticated workflow coverage comes from the browser suite, not the public demo screenshot.

Passing existing tests validates their covered behavior; it does not cover the confirmed missing workflows. This review adds documentation only and does not fix or deploy the findings.
