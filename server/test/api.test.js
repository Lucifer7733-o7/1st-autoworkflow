import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createScanner } from '../src/scanner.js';
import { createApp } from '../src/app.js';
import { makeWav, makePng } from '../scripts/make-sample-music.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'home-stream-'));
const musicDir = path.join(tmp, 'music');
const coversDir = path.join(tmp, 'covers');
const quiet = { info() {}, warn() {} };
let server;
let base;
let cookie = '';
let db;
let scanner;

function addSong(rel, tags) {
  const file = path.join(musicDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, makeWav({ seconds: 2, notes: [440, 660], tags }));
  return file;
}

async function api(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

before(async () => {
  fs.mkdirSync(coversDir, { recursive: true });
  addSong('A/One/01.wav', { INAM: 'Alpha', IART: 'Artist A', IPRD: 'One', ITRK: '1' });
  addSong('A/One/02.wav', { INAM: 'Beta 100%', IART: 'Artist A', IPRD: 'One', ITRK: '2' });
  addSong('B/Two/01.wav', { INAM: 'Gamma', IART: 'Artist B', IPRD: 'Two', ITRK: '1' });
  fs.writeFileSync(path.join(musicDir, 'A/One/cover.png'), makePng(8, [0, 0, 0], [255, 255, 255]));
  fs.writeFileSync(path.join(musicDir, 'notes.txt'), 'not audio');

  const config = {
    musicDir,
    coversDir,
    webDist: path.join(tmp, 'no-web'),
    password: 'secret',
    sessionSecret: 'test-secret',
    sessionDays: 1,
  };
  db = openDb(path.join(tmp, 'test.db'));
  scanner = createScanner(db, { musicDir, coversDir, log: quiet });
  await scanner.scan();
  const app = createApp({ db, scanner, config });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  db?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('rejects API calls without login and wrong passwords', async () => {
  assert.equal((await api('GET', '/api/tracks')).status, 401);
  assert.equal((await api('POST', '/api/login', { password: 'nope' })).status, 401);
  assert.deepEqual((await api('GET', '/api/me')).body, { authEnabled: true, loggedIn: false });
});

test('logs in with the right password', async () => {
  const res = await api('POST', '/api/login', { password: 'secret' });
  assert.equal(res.status, 200);
  cookie = res.headers.get('set-cookie').split(';')[0];
  assert.equal((await api('GET', '/api/me')).body.loggedIn, true);
});

test('scanner indexes tracks, albums, artists and folder covers', async () => {
  const { body } = await api('GET', '/api/stats');
  assert.equal(body.tracks, 3);
  assert.equal(body.albums, 2);
  assert.equal(body.artists, 2);

  const albums = (await api('GET', '/api/albums')).body;
  const one = albums.find((a) => a.title === 'One');
  assert.equal(one.artist, 'Artist A');
  assert.equal(one.track_count, 2);
  assert.equal(one.has_cover, true);

  const detail = (await api('GET', `/api/albums/${one.id}`)).body;
  assert.deepEqual(
    detail.tracks.map((t) => t.title),
    ['Alpha', 'Beta 100%'],
  );

  const cover = await fetch(`${base}/api/cover/album/${one.id}`, { headers: { cookie } });
  assert.equal(cover.status, 200);
  assert.equal(cover.headers.get('content-type'), 'image/png');
});

test('streams audio with HTTP range support', async () => {
  const [track] = (await api('GET', '/api/tracks')).body.tracks;
  const full = await fetch(`${base}/api/stream/${track.id}`, { headers: { cookie } });
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  const size = Number(full.headers.get('content-length'));

  const part = await fetch(`${base}/api/stream/${track.id}`, { headers: { cookie, range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 100-199/${size}`);
  assert.equal((await part.arrayBuffer()).byteLength, 100);

  assert.equal((await api('GET', '/api/stream/99999')).status, 404);
});

test('search matches titles and treats % literally', async () => {
  const res = (await api('GET', '/api/search?q=100%25')).body;
  assert.deepEqual(
    res.tracks.map((t) => t.title),
    ['Beta 100%'],
  );
  const byArtist = (await api('GET', '/api/search?q=artist b')).body;
  assert.equal(byArtist.artists.length, 1);
  assert.equal(byArtist.tracks[0].title, 'Gamma');
});

test('favorites, plays and playlists', async () => {
  const tracks = (await api('GET', '/api/tracks')).body.tracks;
  const [a, b, c] = tracks.map((t) => t.id);

  await api('PUT', `/api/favorites/${b}`);
  assert.deepEqual(
    (await api('GET', '/api/favorites')).body.map((t) => t.id),
    [b],
  );

  await api('POST', `/api/plays/${c}`);
  await api('POST', `/api/plays/${c}`);
  await api('POST', `/api/plays/${a}`);
  const home = (await api('GET', '/api/home')).body;
  assert.deepEqual(
    home.recentlyPlayed.map((t) => t.id),
    [a, c],
  );
  assert.equal(home.mostPlayed[0].id, c);

  const created = await api('POST', '/api/playlists', { name: 'Mix', trackIds: [a, 99999] });
  assert.equal(created.status, 201);
  const id = created.body.id;
  await api('POST', `/api/playlists/${id}/tracks`, { trackIds: [b, c] });
  assert.deepEqual(
    (await api('GET', `/api/playlists/${id}`)).body.tracks.map((t) => t.id),
    [a, b, c],
  );
  await api('PUT', `/api/playlists/${id}/tracks`, { trackIds: [c, a] });
  assert.deepEqual(
    (await api('GET', `/api/playlists/${id}`)).body.tracks.map((t) => t.id),
    [c, a],
  );
  await api('DELETE', `/api/playlists/${id}`);
  assert.equal((await api('GET', `/api/playlists/${id}`)).status, 404);
});

test('rescan picks up changes and removes deleted files', async () => {
  addSong('B/Two/02.wav', { INAM: 'Delta', IART: 'Artist B', IPRD: 'Two', ITRK: '2' });
  fs.rmSync(path.join(musicDir, 'A'), { recursive: true });
  const { last } = await scanner.scan();
  assert.equal(last.added, 1);
  assert.equal(last.removed, 2);

  const stats = (await api('GET', '/api/stats')).body;
  assert.deepEqual([stats.tracks, stats.albums, stats.artists], [2, 1, 1]);
  assert.deepEqual(fs.readdirSync(coversDir), []);
});
