import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(rootDir, 'data'));
fs.mkdirSync(path.join(dataDir, 'covers'), { recursive: true });

// Reuse one secret across restarts so logins survive a reboot.
function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, 'session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  port: Number(process.env.PORT || 4533),
  musicDir: path.resolve(process.env.MUSIC_DIR || path.join(rootDir, 'music')),
  dataDir,
  coversDir: path.join(dataDir, 'covers'),
  dbFile: path.join(dataDir, 'library.db'),
  webDist: path.resolve(process.env.WEB_DIST || path.join(rootDir, 'web', 'dist')),
  password: process.env.APP_PASSWORD || '',
  sessionSecret: loadSessionSecret(),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  scanOnStart: process.env.SCAN_ON_START !== 'false',
  scanIntervalMinutes: Number(process.env.SCAN_INTERVAL_MINUTES || 0),
};
