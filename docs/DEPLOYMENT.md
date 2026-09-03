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
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-5.6-terra`
6. Deploy the `main` branch.

Never add secret values to Git, screenshots, client code, or variables prefixed with `NEXT_PUBLIC_`.

## Release verification

After deployment:

1. Open `/api/health`; it should return HTTP 200 with `database: true`.
2. Create a Supabase Auth user and bootstrap its profile, company, and owner membership.
3. Sign in at `/login` and confirm `/workspace` loads the correct company.
4. Ask a harmless test question in AI assistant and confirm no API key reaches browser network responses.
5. Run the Supabase database tests and advisors before entering real financial data.

The public root route is a demo. The authenticated workspace is the production application.
