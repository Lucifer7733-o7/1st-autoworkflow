// Downloads the playlist's song list into website/playlist.json using the YouTube Data API.
// Run by the "Website" GitHub Action on a schedule, or locally:
//   YT_API_KEY=... node scripts/sync-playlist.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'website');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(siteDir, 'config.js'), 'utf8'), sandbox);
const config = sandbox.window.SITE_CONFIG || {};

function playlistIdFrom(value = '') {
  try {
    const list = new URL(value).searchParams.get('list');
    if (list) return list;
  } catch {
    /* not a URL */
  }
  return value.trim();
}

const key = process.env.YT_API_KEY;
const playlistId = process.env.PLAYLIST_ID || playlistIdFrom(config.playlist);
if (!key) {
  console.error('Set YT_API_KEY to a YouTube Data API v3 key.');
  process.exit(1);
}
if (!playlistId) {
  console.error('No playlist set in website/config.js.');
  process.exit(1);
}

async function get(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.search = new URLSearchParams({ ...params, key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${await res.text()}`);
  return res.json();
}

function seconds(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}

const tracks = [];
let pageToken = '';
do {
  const data = await get('playlistItems', { part: 'snippet,status', maxResults: '50', playlistId, ...(pageToken && { pageToken }) });
  for (const item of data.items || []) {
    const s = item.snippet;
    const id = s?.resourceId?.videoId;
    if (!id || item.status?.privacyStatus === 'private' || ['Deleted video', 'Private video'].includes(s.title)) continue;
    tracks.push({
      id,
      title: s.title,
      channel: (s.videoOwnerChannelTitle || '').replace(/ - Topic$/, ''),
      thumb: s.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    });
  }
  pageToken = data.nextPageToken || '';
} while (pageToken);

for (let i = 0; i < tracks.length; i += 50) {
  const batch = tracks.slice(i, i + 50);
  const data = await get('videos', { part: 'contentDetails,status', id: batch.map((t) => t.id).join(',') });
  const byId = new Map((data.items || []).map((v) => [v.id, v]));
  for (const t of batch) {
    const v = byId.get(t.id);
    t.duration = seconds(v?.contentDetails?.duration);
    if (v && v.status?.embeddable === false) t.unavailable = true;
  }
}

const out = path.join(siteDir, 'playlist.json');
fs.writeFileSync(out, JSON.stringify({ playlistId, updatedAt: new Date().toISOString(), tracks }, null, 2) + '\n');
console.log(`Wrote ${tracks.length} songs to ${path.relative(root, out)}`);
