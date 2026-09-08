<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Release workflow

The user has authorized committing, pushing, and deploying completed local changes to production by default (September 8, 2026). After relevant verification passes, commit the changes, push the working branch, apply any required reviewed database migrations, and deploy/promote the production release. Verify the live deployment and report its outcome. Do not stop to request deployment approval again unless the user changes this instruction or a concrete blocker requires input. Keep secrets out of Git and preserve unrelated work.
