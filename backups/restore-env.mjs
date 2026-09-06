import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createDecipheriv } from 'node:crypto';

const [keyPath, outputPath] = process.argv.slice(2);
if (!keyPath || !outputPath) {
  throw new Error('Usage: node backups/restore-env.mjs /path/to/recovery-key /path/to/.env.local');
}
const backup = JSON.parse(readFileSync(new URL('./env.local.encrypted.json', import.meta.url), 'utf8'));
if (backup.version !== 1 || backup.algorithm !== 'aes-256-gcm') {
  throw new Error('Unsupported backup format');
}
const key = createHash('sha256').update(readFileSync(keyPath, 'utf8').trim()).digest();
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(backup.iv, 'base64'));
decipher.setAuthTag(Buffer.from(backup.tag, 'base64'));
const plaintext = Buffer.concat([decipher.update(Buffer.from(backup.data, 'base64')), decipher.final()]);
writeFileSync(outputPath, plaintext, { flag: 'wx', mode: 0o600 });
console.log('Environment file restored.');
