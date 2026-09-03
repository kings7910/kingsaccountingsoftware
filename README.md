# King’s Accounting Software

A responsive accounting and trucking operations platform built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Local setup

1. Copy `.env.example` to `.env.local` and add your Supabase project values.
2. Run `npm install`.
3. Run `npm run dev` and open http://localhost:3000.

Without Supabase credentials the interface runs in demo mode with sample company data. No production database is ever seeded automatically.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:start
npm run db:reset
npm run db:test
```

## Deployment

Import the GitHub repository into Vercel and configure the variables documented in `.env.example` separately for Preview and Production. Apply migrations with `supabase db push` from an authenticated deployment workflow; do not run `db:reset` against production.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the security model and module design.
