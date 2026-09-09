# Invoice PDFs and business email

## Using invoice documents

In **Invoices**, choose **PDF / email** on an invoice. **Download PDF** creates a document using the current company, customer, invoice lines and allocation balances. Draft documents are marked **DRAFT — NOT ISSUED**. Historical invoices identify their legacy accounting basis. Finance readers can download documents; active owners, administrators and accountants can send issued, ledger-backed invoices.

PDFs support the bundled DejaVu Sans character set, wrap long descriptions and continue across pages. Unsupported characters fail explicitly instead of silently changing names. Limits are 2,000 invoice lines and a 4 MB generated PDF. Amounts are USD. Documents show current data when downloaded; an email attempt stores its PDF and message so retries preserve the original content.

## Connecting email

1. Apply migration `20260908230815_invoice_documents_delivery.sql` before deploying this interface.
2. Set the server-only `INVOICE_EMAIL_ENCRYPTION_KEY` to a securely generated 32-byte key encoded as 64 hexadecimal characters. The application also requires its existing Supabase service-role configuration. Store the encryption key in the deployment's secret manager; never use a `NEXT_PUBLIC_` variable. Preserve it with the database backup. Replacing it makes existing encrypted credentials and pending email snapshots unreadable.
3. An owner or administrator opens **Settings → Notifications → Business invoice email**, enters a sender name, verified sender email and Resend API key, and chooses **Save email setup**. A blank key preserves an existing saved key. Saving configuration does not test the credentials or send an email.
4. Open the invoice's **PDF / email** panel, review or enter one recipient address, then choose **Send invoice email**. This is a separate, explicit action from issuing an invoice.

Resend's sender-domain requirements and API fields are documented in its [send-email reference](https://resend.com/docs/api-reference/emails/send-email).

## Status and retry behavior

**Accepted** means Resend accepted the message; it does not prove inbox delivery. Webhook delivery/bounce tracking and automatic reminder scheduling are not implemented. The notification preference checkboxes remain inactive saved preferences.

A failed or uncertain request retains its attempt ID. Use **Retry same email** or reopen the panel and choose **Retry this attempt** in history. The database allows only one active two-minute processing lease per attempt, and retries use the same saved PDF, recipient, sender, credential and provider idempotency key. Accepted attempts cannot resend. Attempts older than 23 hours cannot retry: check provider history before deliberately creating a new email. A definite rejection may require correcting sender setup or the recipient and starting a new attempt after closing and reopening the panel. Disconnecting email prevents further sends until a sender is reconnected; historical snapshots remain retained.

Recent history displays the latest 50 attempts. Email does not change invoice issuance, payment status or the books. No external money movement is involved.

## Access and retention

Email credentials are encrypted with AES-256-GCM and authenticated against the company ID. Credentials and saved payloads have no client read/write grants. The server checks active membership before every action; history uses company-scoped finance RLS. Only the server role may prepare or claim delivery attempts. No API key is returned to the settings form.

Saved messages contain customer information and attached PDFs; include these database records in the organization's retention and backup procedures. Automatic payload cleanup, key rotation tooling and delivery webhooks remain follow-up work.

## Editing your invoice template

Open **Invoices → Invoice template** to customize the business name, multiline address, phone, contact email, website, optional tax/registration number, logo, accent color, layout, payment instructions and footer. Modern adds a color band; Classic uses clean letterhead. The contact email can be a Yahoo address: it is printed on the PDF and is separate from the automatic email sender configuration.

The design preview updates as you edit. **Preview PDF** downloads an exact sample PDF using the unsaved design. **Save template** validates the logo and text with the PDF renderer, then stores the design for your company. PNG and JPEG logos are limited to 300 KB and 4096 × 4096 pixels. Invalid images or unsupported text characters must be corrected before saving.

Owners, administrators and accountants can edit the template. Auditors can view and preview it. Business identity changes here affect invoice documents only; legal company settings and invoice amounts stay as recorded. Saved changes apply to subsequent downloads of existing or new invoices, and to new email attempts. Already prepared email attempts keep their original PDF when retried.
