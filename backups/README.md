# Environment backup

`env.local.encrypted.json` contains an authenticated AES-256-GCM encrypted snapshot of `.env.local`. The random recovery key is stored separately and must never be committed. Download `.env.backup-recovery.local` and keep it in a password manager or another secure location before deleting the workspace. Without this key the backup cannot be restored.

Restore using Node.js (no dependencies needed):

```sh
node backups/restore-env.mjs /path/to/.env.backup-recovery.local /path/to/.env.local
```

The restore command refuses to overwrite an existing file. This snapshot does not automatically update when environment variables change. Expired or rotated credentials must be refreshed after restoration.
