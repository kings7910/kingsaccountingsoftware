# Architecture

King’s Accounting is a Next.js App Router application with a Supabase-backed data model. It currently renders a complete demo workspace when Supabase environment variables are absent. The visible dashboard and module forms are prototype interactions; persistence should be added through server-side application services before production use.

## Application layers

- `src/app` defines the public demo dashboard, protected workspace, driver, and login routes.
- `src/components` contains the responsive shell and accounting/trucking module views.
- `src/lib` contains deterministic calculations, role permissions, demo data, and Supabase client factories.
- `supabase/migrations` defines the multi-company accounting and fleet schema, database constraints, triggers, storage buckets, and row-level security (RLS).

Browser code only receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role or secret keys must never be exposed through `NEXT_PUBLIC_*` variables. Server Components obtain their client through `src/lib/supabase/server.ts`; interactive client components use `src/lib/supabase/browser.ts`.

The root route is an intentional read/write-in-browser demo. Production users sign in at `/login` and enter `/workspace`. Next.js middleware refreshes Supabase cookies, validates identity with `auth.getClaims()`, and redirects unauthenticated workspace requests. The workspace independently verifies claims on the server before loading the user profile, active company membership, or company identity. Signing out revokes the browser session and returns to the login page.

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

Supabase Storage buckets are private. Object paths must start with the owning company UUID so storage policies can enforce membership. Receipt replacement requires select, insert, and update access; deletion is restricted to owner, administrator, and accountant roles.

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
