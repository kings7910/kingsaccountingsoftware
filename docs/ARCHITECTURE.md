# Architecture

King’s Accounting is a Next.js App Router application with a Supabase-backed data model. It renders a complete local demo when Supabase environment variables are absent; authenticated workspaces use server actions and transactional database functions for persistence.

## Application layers

- `src/app` defines the public demo dashboard, protected workspace, driver, and login routes.
- `src/components` contains the responsive shell and accounting/trucking module views.
- `src/lib` contains deterministic calculations, role permissions, demo data, and Supabase client factories.
- `supabase/migrations` defines the multi-company accounting and fleet schema, database constraints, triggers, storage buckets, and row-level security (RLS).

Browser code only receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role or secret keys must never be exposed through `NEXT_PUBLIC_*` variables. Server Components obtain their client through `src/lib/supabase/server.ts`; interactive client components use `src/lib/supabase/browser.ts`.

The root route is an intentional read/write-in-browser demo. Production users sign in at `/login` and enter `/workspace`; drivers are routed to `/driver`. Next.js middleware refreshes Supabase cookies, validates identity with `auth.getClaims()`, and redirects unauthenticated application requests. The workspace independently verifies claims on the server before loading the user profile, active company membership, or company identity. Signing out revokes the browser session and returns to the login page.

## Tenant and authorization model

Every business record carries a `company_id`. Active `company_memberships` establish tenant access and assign one of these roles: owner, administrator, accountant, dispatcher, fleet manager, payroll manager, driver, or auditor.

RLS is enabled on every table in the exposed `public` schema. Shared membership checks live in the unexposed `private` schema, have a fixed empty search path, and are executable only by authenticated users. Write policies require an operational or finance role, while deletion is restricted to owners and administrators. Profile access is limited to the current user and active coworkers.

Sensitive records use narrower policies than ordinary company data. Payroll records are limited to owners, administrators, and payroll managers, with workers able to read only their own identity or settlement records. Bank and reconciliation data is finance-only, audit history is restricted and append-only from trusted code, notifications are user-owned, and drivers can read only their own identity and assigned operational records. Do not treat ciphertext-named columns as encrypted until an application-managed encryption service is connected.

## Financial integrity

- Journal lines permit exactly one positive debit or credit.
- A journal entry cannot be posted unless its lines balance.
- Posted journal entries cannot be edited; corrections use reversing entries.
- Paid invoices cannot be edited directly; corrections use credit notes or adjustments.
- Newly issued invoices post receivables, freight revenue and any sales tax in one transaction. Their headers and lines become immutable; dated customer payments and credit notes post separate journals. Payments select an existing cash/asset ledger account. Credits reverse the original invoice's tax proportionally and preserve customer credit balances after payment. A/R aging reports customer credits separately and reconciles to account 1100.
- Invoice creation, customer payments and customer credits accept stable request IDs. Repeating an identical request returns its original result; reusing the ID with different input is rejected. Database triggers also protect direct table writes. Invoice-linked journals cannot be reversed independently of the subledger.
- Existing invoices are explicitly marked as legacy during migration and are not automatically posted. Their balances remain visible in reports, but changes require accountant reconciliation of existing journals. This avoids duplicating historical manual entries. A guided legacy reconciliation tool, customer-payment reversal/refund workflow, and cash transfer integrations remain separate work.
- Paid driver settlements cannot be reopened, edited or deleted. Their shared payroll-period dates cannot be changed. Corrections must preserve the original paid record; a separate settlement-correction interface remains future scope.
- Open vendor bills post the selected expense against account 2000, and vendor payments post account 2000 against the selected asset account in the same database transaction.
- Voiding an unpaid posted bill creates and posts a linked reversing journal before changing the bill status.
- Vendor credits and debits are immutable dated records with separate balanced journals. They recalculate payment limits and bill status, preserve vendor credits, and prevent an adjusted bill from being voided by reversing only its original journal.
- Bank CSV rows are signed movements and can only match posted journals with an equal movement on the bank account's linked asset ledger. Stable import hashes prevent duplicate statement rows. Completed reconciliation periods require resolved rows and an exact statement-to-book closing balance, then lock both the reconciliation and its rows.
- Amount, mileage, odometer, and accounting-period constraints reject invalid values at the database boundary.

These controls complement application validation; they do not replace review workflows, tax advice, payroll filing services, or accountant approval.

## Documents

Supabase Storage buckets are private. Object paths start with the company and uploading user UUIDs. Drivers can access their own uploaded receipts; privileged operational and finance roles can access company documents. Receipt metadata is recorded atomically after Storage upload.

## Deployment and verification

Use separate Supabase projects and Vercel variables for local, preview, and production environments. Apply reviewed migrations with `supabase db push`; never reset a production database. Before deployment, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:test
```

The local database checks require Docker and the Supabase CLI. Run Supabase database advisors after schema changes and resolve security and performance findings before production release.

## Driver submissions on unreliable connections

Trip drafts are scoped to the driver and load. Each mileage or fuel submission is saved as a separate browser storage record containing its original driver and load before transmission. Server actions check that the authenticated driver matches the saved identity; database functions still enforce load assignment. Previously saved records with no driver or load reference are preserved but never automatically imported or transmitted.

Synchronization uses an exclusive browser Web Lock to coordinate tabs. Each new transmission includes the saved UUID as its request ID. An unexposed database request ledger records the submission and its resulting business record in the same transaction. Repeating the same request returns the original result; reusing its ID with different data is rejected. This makes retries after lost responses safe. Records attempted before this mechanism was introduced remain available for manual office review, because their original database writes cannot be deduplicated retroactively.

Pending driver mileage, fuel, and receipts create linked approval items. Decisions update the source record atomically and require the corresponding operational or finance role. Removed company members cannot retain driver access through old access tokens.
Queued records can synchronize even when the driver no longer has an active load. New submissions require a loaded assignment. This queue needs browser storage and Web Locks in a secure context; it does not make the application shell available for a cold offline launch. Browser data must be retained until submissions are confirmed.

## Release integrity controls

Company-scoped foreign keys include both company and record identity, preventing references across tenants even when a user belongs to both companies. The ledger restricts reads to finance staff and auditors, and writes to finance staff. Journals are created as drafts, must balance before posting, reject postings into closed periods, and reject subsequent line additions or changes. Reversals use the same posting checks and have a unique source reference. Transaction type changes and partner resolution use one database transaction so a failed replacement preserves the original record.

Financial statements use posted ledger entries, including unclosed earnings in equity and cumulative account balances in the trial balance. They do not fall back to load revenue or estimated costs. Report queries paginate their top-level data sets. A/R aging uses dated customer payments and credits. A/P aging uses the vendor-bill subledger, due dates, dated payments, and dated credit/debit adjustments; vendor credits appear separately and reduce the subledger total. Ambiguous paid flags make either aging report unavailable rather than inventing history. Its report compares the subledger total with the posted credit balance of ledger account 2000 and exposes any difference. Cash movement covers ledger account 1000 without pretending to classify operating, investing and financing flows. Operational contribution reports state their narrower cost basis.

Manual bank statement imports are parsed only in a server action; the application stores normalized rows and minimal source metadata rather than the uploaded file. Database functions validate finance access, tenant identity, file-batch counts, exact journal matches, non-overlapping completed periods, and the closing book balance. Direct inserts or state changes to statement rows and reconciliations are rejected by workflow guards. Live bank connectivity remains a separate provider integration.

Invoice browsing uses a 50-record cursor page ordered by issue date and identity, with an explicit load-older control. Search and filters cover loaded records. Real company settings use blank identity defaults and cannot be saved after an initial read failure; the demonstration company identity remains confined to demo mode. Email preference controls disclose that delivery is not connected.

The dashboard uses the posted-ledger calculation rules for income, expenses, profit and its monthly chart. Its aggregate queries read ID cursor pages until an empty page, including when the API caps responses below the requested page size. Journal lines, payments and credits are paged independently. A failed page aborts the response. Remaining invoice balances respect dated allocations; fleet ratios use current-month ledger activity and approved mileage, with fuel shown separately. These reads enforce active company membership and retain RLS visibility. The multi-query dashboard is a current operational view, not a transactionally frozen accounting snapshot.
