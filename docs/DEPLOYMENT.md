# Production deployment

The recommended production path is GitHub to Vercel with a hosted Supabase project.

## Required account setup

1. Create or select a Supabase project.
2. Apply the committed migrations with `npx supabase db push`.
3. In Supabase Auth, add the production URL and `https://YOUR_DOMAIN/**` as allowed redirect URLs.
4. Import `kings7910/kingsaccountingsoftware` into Vercel.
5. Configure these Vercel Production and Preview variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for team invitations)
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-5-mini`
6. Deploy the `main` branch.

Never add secret values to Git, screenshots, client code, or variables prefixed with `NEXT_PUBLIC_`.

## Release verification

After deployment:

1. Open `/api/health`; it should return HTTP 200 with `database: true` and `auth: true`. This endpoint performs live, five-second-timeout probes rather than checking only for environment variables.
2. Create an account, confirm its email, and complete `/onboarding` to create the company and owner membership.
3. Sign in at `/login` and confirm `/workspace` loads the correct company.
4. Ask a harmless test question in AI assistant and confirm no API key reaches browser network responses.
5. Run the Supabase database tests and advisors before entering real financial data.

The public root route is a demo. The authenticated workspace is the production application.

## Reproducible local release verification

Use Node 22 and an isolated local Supabase stack. The browser suite refuses hosted database URLs and creates only local test accounts and records.

```bash
npm ci
npm run db:start
npm run db:test
npx supabase db lint --local --level error
npx supabase db advisors --local --type all --level warn --fail-on error
npx playwright install --with-deps chromium
npx supabase status -o json > /tmp/kings-local-supabase.json
KINGS_TEST_CONFIG=/tmp/kings-local-supabase.json npm run test:e2e
npm run lint
npm run typecheck
npm test
npm run build
```

The status JSON contains local test credentials; keep it outside Git. GitHub Actions runs application checks separately from the local database and browser workflows. Browser traces contain test-session data and are retained only on failures.

Apply migrations before deploying the corresponding application code. Verify migration history and advisors in the intended hosted environment, then run the release checks above against a preview deployment. Configure production email delivery, recovery URLs, backups and restore procedures before onboarding real financial data. Automatic payroll tax filing, bank feeds, payment processing and OCR require separate integrations; their configuration placeholders do not indicate working integrations.
