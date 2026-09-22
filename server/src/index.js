import fs from 'node:fs';
import { config } from './config.js';
import { openDb } from './db.js';
import { createScanner } from './scanner.js';
import { createApp } from './app.js';

const db = openDb(config.dbFile);
const scanner = createScanner(db, config);
const app = createApp({ db, scanner, config });

app.listen(config.port, () => {
  console.log(`Home Stream listening on http://localhost:${config.port}`);
  console.log(`Music folder: ${config.musicDir}`);
  if (!config.password) console.warn('APP_PASSWORD is not set: anyone who can reach this server can use it.');

  if (!fs.existsSync(config.musicDir)) {
    console.warn(`Music folder does not exist yet. Create it, add music, then press "Rescan" in the app.`);
  } else if (config.scanOnStart) {
    scanner.scan().catch((err) => console.error('scan failed', err));
  }
  if (config.scanIntervalMinutes > 0) {
    setInterval(() => scanner.scan().catch((err) => console.error('scan failed', err)), config.scanIntervalMinutes * 60_000);
  }
});
