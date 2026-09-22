import path from 'node:path';
import fs from 'node:fs';
import express from 'express';

const TRACK_SELECT = `
  SELECT t.id, t.title, t.duration, t.track_no, t.disc_no, t.year, t.genre, t.format, t.bitrate,
         t.artist_id, ar.name AS artist, t.album_id, al.title AS album,
         (al.cover_file IS NOT NULL) AS has_cover, (f.track_id IS NOT NULL) AS favorite
  FROM tracks t
  JOIN artists ar ON ar.id = t.artist_id
  JOIN albums al ON al.id = t.album_id
  LEFT JOIN favorites f ON f.track_id = t.id`;

const ALBUM_SELECT = `
  SELECT al.id, al.title, al.year, al.artist_id, ar.name AS artist, (al.cover_file IS NOT NULL) AS has_cover,
         al.created_at, COUNT(t.id) AS track_count, COALESCE(SUM(t.duration), 0) AS duration
  FROM albums al
  JOIN artists ar ON ar.id = al.artist_id
  LEFT JOIN tracks t ON t.album_id = al.id`;

const ALBUM_ORDER = {
  title: 'al.title COLLATE NOCASE',
  artist: 'ar.name COLLATE NOCASE, al.year, al.title COLLATE NOCASE',
  year: 'al.year DESC, al.title COLLATE NOCASE',
  recent: 'al.created_at DESC, al.id DESC',
};

const toTrack = (r) => r && { ...r, has_cover: !!r.has_cover, favorite: !!r.favorite };
const toAlbum = (r) => r && { ...r, has_cover: !!r.has_cover };
const likeArg = (s) => `%${s.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

function intParam(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return max ? Math.min(n, max) : n;
}

export function createApi({ db, scanner, config }) {
  const r = express.Router();

  const tracksByIds = (ids) => {
    if (!ids.length) return [];
    const rows = db.prepare(`${TRACK_SELECT} WHERE t.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const byId = new Map(rows.map((row) => [row.id, toTrack(row)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  };

  // ---- Library -----------------------------------------------------------

  r.get('/stats', (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM tracks) AS tracks, (SELECT COUNT(*) FROM albums) AS albums,
                  (SELECT COUNT(*) FROM artists) AS artists, (SELECT COALESCE(SUM(duration),0) FROM tracks) AS duration`,
        )
        .get(),
    );
  });

  r.get('/home', (_req, res) => {
    const recentAlbums = db
      .prepare(`${ALBUM_SELECT} GROUP BY al.id ORDER BY al.created_at DESC, al.id DESC LIMIT 12`)
      .all()
      .map(toAlbum);
    const recentIds = db
      .prepare('SELECT track_id FROM plays GROUP BY track_id ORDER BY MAX(id) DESC LIMIT 12')
      .all()
      .map((p) => p.track_id);
    const topIds = db
      .prepare('SELECT track_id FROM plays GROUP BY track_id ORDER BY COUNT(*) DESC, MAX(id) DESC LIMIT 12')
      .all()
      .map((p) => p.track_id);
    res.json({ recentAlbums, recentlyPlayed: tracksByIds(recentIds), mostPlayed: tracksByIds(topIds) });
  });

  r.get('/tracks', (req, res) => {
    const limit = intParam(req.query.limit, 500, 5000);
    const offset = intParam(req.query.offset, 0);
    const rows = db
      .prepare(`${TRACK_SELECT} ORDER BY t.title COLLATE NOCASE LIMIT ? OFFSET ?`)
      .all(limit, offset)
      .map(toTrack);
    res.json({ tracks: rows, total: db.prepare('SELECT COUNT(*) AS n FROM tracks').get().n });
  });

  r.get('/albums', (req, res) => {
    const order = ALBUM_ORDER[req.query.sort] || ALBUM_ORDER.title;
    res.json(db.prepare(`${ALBUM_SELECT} GROUP BY al.id ORDER BY ${order}`).all().map(toAlbum));
  });

  r.get('/albums/:id', (req, res) => {
    const album = toAlbum(db.prepare(`${ALBUM_SELECT} WHERE al.id = ? GROUP BY al.id`).get(req.params.id));
    if (!album) return res.status(404).json({ error: 'Album not found' });
    const tracks = db
      .prepare(`${TRACK_SELECT} WHERE t.album_id = ? ORDER BY t.disc_no, t.track_no, t.title COLLATE NOCASE`)
      .all(album.id)
      .map(toTrack);
    res.json({ ...album, tracks });
  });

  r.get('/artists', (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT ar.id, ar.name,
                  (SELECT COUNT(*) FROM albums WHERE artist_id = ar.id) AS album_count,
                  (SELECT COUNT(*) FROM tracks WHERE artist_id = ar.id) AS track_count,
                  (SELECT id FROM albums WHERE artist_id = ar.id AND cover_file IS NOT NULL LIMIT 1) AS cover_album_id
           FROM artists ar ORDER BY ar.name COLLATE NOCASE`,
        )
        .all(),
    );
  });

  r.get('/artists/:id', (req, res) => {
    const artist = db.prepare('SELECT id, name FROM artists WHERE id = ?').get(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    const albums = db
      .prepare(`${ALBUM_SELECT} WHERE al.artist_id = ? GROUP BY al.id ORDER BY al.year DESC, al.title COLLATE NOCASE`)
      .all(artist.id)
      .map(toAlbum);
    const tracks = db
      .prepare(`${TRACK_SELECT} WHERE t.artist_id = ? ORDER BY al.year DESC, al.title, t.disc_no, t.track_no`)
      .all(artist.id)
      .map(toTrack);
    res.json({ ...artist, albums, tracks });
  });

  r.get('/search', (req, res) => {
    const term = String(req.query.q || '').trim();
    if (!term) return res.json({ tracks: [], albums: [], artists: [] });
    const like = likeArg(term);
    res.json({
      artists: db
        .prepare(
          `SELECT ar.id, ar.name,
                  (SELECT id FROM albums WHERE artist_id = ar.id AND cover_file IS NOT NULL LIMIT 1) AS cover_album_id
           FROM artists ar WHERE ar.name LIKE ? ESCAPE '\\' ORDER BY ar.name COLLATE NOCASE LIMIT 20`,
        )
        .all(like),
      albums: db
        .prepare(
          `${ALBUM_SELECT} WHERE al.title LIKE ? ESCAPE '\\' OR ar.name LIKE ? ESCAPE '\\'
           GROUP BY al.id ORDER BY al.title COLLATE NOCASE LIMIT 30`,
        )
        .all(like, like)
        .map(toAlbum),
      tracks: db
        .prepare(
          `${TRACK_SELECT} WHERE t.title LIKE ? ESCAPE '\\' OR ar.name LIKE ? ESCAPE '\\' OR al.title LIKE ? ESCAPE '\\'
           ORDER BY t.title COLLATE NOCASE LIMIT 100`,
        )
        .all(like, like, like)
        .map(toTrack),
    });
  });

  // ---- Media -------------------------------------------------------------

  r.get('/stream/:id', (req, res) => {
    const row = db.prepare('SELECT path FROM tracks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Track not found' });
    const file = path.resolve(config.musicDir, row.path);
    if (!file.startsWith(config.musicDir + path.sep)) return res.status(403).end();
    // sendFile handles Range requests (206 Partial Content), which the browser needs for seeking.
    res.sendFile(path.relative(config.musicDir, file), { root: config.musicDir, dotfiles: 'allow', maxAge: '1h' }, (err) => {
      if (err && !res.headersSent) res.status(err.statusCode || 404).json({ error: 'File unavailable' });
    });
  });

  r.get('/cover/album/:id', (req, res) => {
    const row = db.prepare('SELECT cover_file FROM albums WHERE id = ?').get(req.params.id);
    if (!row?.cover_file) return res.status(404).end();
    res.sendFile(row.cover_file, { root: config.coversDir, dotfiles: 'allow', maxAge: '7d' }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  r.post('/plays/:id', (req, res) => {
    const exists = db.prepare('SELECT 1 FROM tracks WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Track not found' });
    db.prepare('INSERT INTO plays (track_id) VALUES (?)').run(req.params.id);
    res.status(204).end();
  });

  // ---- Favorites ---------------------------------------------------------

  r.get('/favorites', (_req, res) => {
    res.json(db.prepare(`${TRACK_SELECT} WHERE f.track_id IS NOT NULL ORDER BY f.created_at DESC`).all().map(toTrack));
  });

  r.put('/favorites/:id', (req, res) => {
    const exists = db.prepare('SELECT 1 FROM tracks WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Track not found' });
    db.prepare('INSERT OR IGNORE INTO favorites (track_id) VALUES (?)').run(req.params.id);
    res.json({ favorite: true });
  });

  r.delete('/favorites/:id', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE track_id = ?').run(req.params.id);
    res.json({ favorite: false });
  });

  // ---- Playlists ---------------------------------------------------------

  const getPlaylist = db.prepare(
    `SELECT p.id, p.name, p.created_at, p.updated_at, COUNT(pt.track_id) AS track_count
     FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     WHERE p.id = ? GROUP BY p.id`,
  );
  const playlistTrackIds = db.prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position');
  const touchPlaylist = db.prepare('UPDATE playlists SET updated_at = unixepoch() WHERE id = ?');

  const validTrackIds = (ids) => {
    if (!Array.isArray(ids)) return null;
    const nums = ids.map(Number).filter(Number.isInteger);
    if (!nums.length) return [];
    const unique = [...new Set(nums)];
    const found = new Set(
      db
        .prepare(`SELECT id FROM tracks WHERE id IN (${unique.map(() => '?').join(',')})`)
        .all(...unique)
        .map((t) => t.id),
    );
    return nums.filter((id) => found.has(id));
  };

  const writePlaylistTracks = db.transaction((playlistId, ids) => {
    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);
    const insert = db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)');
    ids.forEach((id, i) => insert.run(playlistId, id, i));
    touchPlaylist.run(playlistId);
  });

  r.get('/playlists', (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT p.id, p.name, p.created_at, p.updated_at, COUNT(pt.track_id) AS track_count,
                  (SELECT al.id FROM playlist_tracks x JOIN tracks t ON t.id = x.track_id JOIN albums al ON al.id = t.album_id
                   WHERE x.playlist_id = p.id AND al.cover_file IS NOT NULL ORDER BY x.position LIMIT 1) AS cover_album_id
           FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
           GROUP BY p.id ORDER BY p.updated_at DESC`,
        )
        .all(),
    );
  });

  r.post('/playlists', (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = db.prepare('INSERT INTO playlists (name) VALUES (?)').run(name.slice(0, 200)).lastInsertRowid;
    const ids = validTrackIds(req.body?.trackIds || []);
    if (ids?.length) writePlaylistTracks(id, ids);
    res.status(201).json(getPlaylist.get(id));
  });

  r.get('/playlists/:id', (req, res) => {
    const playlist = getPlaylist.get(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const ids = playlistTrackIds.all(playlist.id).map((p) => p.track_id);
    res.json({ ...playlist, tracks: tracksByIds(ids) });
  });

  r.patch('/playlists/:id', (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const info = db.prepare('UPDATE playlists SET name = ?, updated_at = unixepoch() WHERE id = ?').run(name, req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Playlist not found' });
    res.json(getPlaylist.get(req.params.id));
  });

  r.delete('/playlists/:id', (req, res) => {
    db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  // Append tracks to the end.
  r.post('/playlists/:id/tracks', (req, res) => {
    const playlist = getPlaylist.get(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const ids = validTrackIds(req.body?.trackIds);
    if (!ids) return res.status(400).json({ error: 'trackIds must be an array' });
    const current = playlistTrackIds.all(playlist.id).map((p) => p.track_id);
    writePlaylistTracks(playlist.id, [...current, ...ids]);
    res.json(getPlaylist.get(playlist.id));
  });

  // Replace the whole track list (used for removing and reordering).
  r.put('/playlists/:id/tracks', (req, res) => {
    const playlist = getPlaylist.get(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const ids = validTrackIds(req.body?.trackIds);
    if (!ids) return res.status(400).json({ error: 'trackIds must be an array' });
    writePlaylistTracks(playlist.id, ids);
    res.json(getPlaylist.get(playlist.id));
  });

  // ---- Scanning ----------------------------------------------------------

  r.get('/scan', (_req, res) => res.json({ ...scanner.status, musicDir: config.musicDir }));

  r.post('/scan', (_req, res) => {
    if (!fs.existsSync(config.musicDir)) {
      return res.status(400).json({ error: `Music folder not found: ${config.musicDir}` });
    }
    scanner.scan().catch((err) => console.error('scan failed', err));
    res.status(202).json({ running: true });
  });

  return r;
}
