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

Financial statements use posted ledger entries, including unclosed earnings in equity and cumulative account balances in the trial balance. They do not fall back to load revenue or estimated costs. Report queries paginate their top-level data sets. A/R aging uses dated customer payments and credits. A/P aging uses the vendor-bill subledger, due dates, and dated bill-payment allocations; ambiguous paid flags make either aging report unavailable rather than inventing history. Vendor bills do not automatically choose expense accounts or post journals, so A/P aging should be reconciled to ledger account 2000 during close. Cash movement covers ledger account 1000 without pretending to classify operating, investing and financing flows. Operational contribution reports state their narrower cost basis.
