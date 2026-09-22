import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile, selectCover } from 'music-metadata';

export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.webm', '.wma', '.aiff', '.aif',
]);
const FOLDER_COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

function extForMime(mime = '') {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  return '.jpg';
}

async function findFolderCover(dir) {
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  const images = names.filter((n) => IMAGE_EXTENSIONS.includes(path.extname(n).toLowerCase()));
  const preferred = images.find((n) => FOLDER_COVER_NAMES.includes(path.parse(n).name.toLowerCase()));
  const pick = preferred || images[0];
  return pick ? path.join(dir, pick) : null;
}

export function createScanner(db, { musicDir, coversDir, log = console }) {
  const q = {
    allTracks: db.prepare('SELECT id, path, size, mtime FROM tracks'),
    findArtist: db.prepare('SELECT id FROM artists WHERE name = ?'),
    insertArtist: db.prepare('INSERT INTO artists (name) VALUES (?)'),
    findAlbum: db.prepare('SELECT id, cover_file, year FROM albums WHERE title = ? AND artist_id = ?'),
    insertAlbum: db.prepare('INSERT INTO albums (title, artist_id, year) VALUES (?, ?, ?)'),
    setAlbumYear: db.prepare('UPDATE albums SET year = ? WHERE id = ?'),
    setAlbumCover: db.prepare('UPDATE albums SET cover_file = ? WHERE id = ?'),
    insertTrack: db.prepare(`
      INSERT INTO tracks (path, title, artist_id, album_id, track_no, disc_no, duration, year, genre, bitrate, format, size, mtime)
      VALUES (@path, @title, @artist_id, @album_id, @track_no, @disc_no, @duration, @year, @genre, @bitrate, @format, @size, @mtime)`),
    updateTrack: db.prepare(`
      UPDATE tracks SET title=@title, artist_id=@artist_id, album_id=@album_id, track_no=@track_no, disc_no=@disc_no,
        duration=@duration, year=@year, genre=@genre, bitrate=@bitrate, format=@format, size=@size, mtime=@mtime
      WHERE id=@id`),
    deleteTrack: db.prepare('DELETE FROM tracks WHERE id = ?'),
    orphanAlbums: db.prepare('SELECT id, cover_file FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)'),
    deleteAlbum: db.prepare('DELETE FROM albums WHERE id = ?'),
    deleteOrphanArtists: db.prepare(`
      DELETE FROM artists
      WHERE id NOT IN (SELECT artist_id FROM tracks) AND id NOT IN (SELECT artist_id FROM albums)`),
  };

  function artistId(name) {
    const row = q.findArtist.get(name);
    return row ? row.id : q.insertArtist.run(name).lastInsertRowid;
  }

  function album(title, artist, year) {
    const row = q.findAlbum.get(title, artist);
    if (row) {
      if (!row.year && year) q.setAlbumYear.run(year, row.id);
      return row;
    }
    const id = q.insertAlbum.run(title, artist, year || null).lastInsertRowid;
    return { id, cover_file: null };
  }

  async function saveCover(albumRow, picture, fileDir) {
    if (albumRow.cover_file) return;
    let data;
    let ext;
    if (picture) {
      data = picture.data;
      ext = extForMime(picture.format);
    } else {
      const folderCover = await findFolderCover(fileDir);
      if (!folderCover) return;
      data = await fs.readFile(folderCover);
      ext = path.extname(folderCover).toLowerCase().replace('.jpeg', '.jpg');
    }
    const name = `${albumRow.id}${ext}`;
    await fs.writeFile(path.join(coversDir, name), data);
    q.setAlbumCover.run(name, albumRow.id);
    albumRow.cover_file = name;
  }

  async function readTrack(fullPath, stat) {
    const meta = await parseFile(fullPath, { duration: false });
    const c = meta.common;
    const f = meta.format;
    const artistName = (c.artist || c.albumartist || 'Unknown Artist').trim();
    const albumArtistName = (c.albumartist || c.artist || 'Unknown Artist').trim();
    const albumTitle = (c.album || 'Unknown Album').trim();

    const albumRow = album(albumTitle, artistId(albumArtistName), c.year);
    await saveCover(albumRow, selectCover(c.picture), path.dirname(fullPath));

    return {
      path: path.relative(musicDir, fullPath),
      title: (c.title || path.parse(fullPath).name).trim(),
      artist_id: artistId(artistName),
      album_id: albumRow.id,
      track_no: c.track?.no ?? null,
      disc_no: c.disk?.no ?? null,
      duration: f.duration ?? null,
      year: c.year ?? null,
      genre: c.genre?.[0] ?? null,
      bitrate: f.bitrate ? Math.round(f.bitrate) : null,
      format: f.container || path.extname(fullPath).slice(1),
      size: stat.size,
      mtime: Math.floor(stat.mtimeMs),
    };
  }

  const status = { running: false, last: null };

  async function scan() {
    if (status.running) return status;
    status.running = true;
    const result = { startedAt: Date.now(), finishedAt: null, added: 0, updated: 0, removed: 0, errors: [] };
    try {
      const known = new Map(q.allTracks.all().map((t) => [t.path, t]));
      const seen = new Set();

      for await (const fullPath of walk(musicDir)) {
        const rel = path.relative(musicDir, fullPath);
        seen.add(rel);
        try {
          const stat = await fs.stat(fullPath);
          const existing = known.get(rel);
          if (existing && existing.size === stat.size && existing.mtime === Math.floor(stat.mtimeMs)) continue;
          const track = await readTrack(fullPath, stat);
          if (existing) {
            q.updateTrack.run({ ...track, id: existing.id });
            result.updated++;
          } else {
            q.insertTrack.run(track);
            result.added++;
          }
        } catch (err) {
          result.errors.push({ path: rel, error: err.message });
          log.warn(`scan: could not read ${rel}: ${err.message}`);
        }
      }

      db.transaction(() => {
        for (const [rel, t] of known) {
          if (!seen.has(rel)) {
            q.deleteTrack.run(t.id);
            result.removed++;
          }
        }
      })();

      for (const a of q.orphanAlbums.all()) {
        q.deleteAlbum.run(a.id);
        if (a.cover_file) await fs.rm(path.join(coversDir, a.cover_file), { force: true });
      }
      q.deleteOrphanArtists.run();
    } finally {
      result.finishedAt = Date.now();
      status.last = result;
      status.running = false;
    }
    log.info(
      `scan: +${result.added} ~${result.updated} -${result.removed} (${result.errors.length} errors) in ${
        result.finishedAt - result.startedAt
      }ms`,
    );
    return status;
  }

  return { scan, status };
}
