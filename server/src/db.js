import Database from 'better-sqlite3';

export function openDb(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id    INTEGER PRIMARY KEY,
      name  TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS albums (
      id          INTEGER PRIMARY KEY,
      title       TEXT NOT NULL,
      artist_id   INTEGER NOT NULL REFERENCES artists(id),
      year        INTEGER,
      cover_file  TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (title, artist_id)
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id          INTEGER PRIMARY KEY,
      path        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      artist_id   INTEGER NOT NULL REFERENCES artists(id),
      album_id    INTEGER NOT NULL REFERENCES albums(id),
      track_no    INTEGER,
      disc_no     INTEGER,
      duration    REAL,
      year        INTEGER,
      genre       TEXT,
      bitrate     INTEGER,
      format      TEXT,
      size        INTEGER NOT NULL,
      mtime       INTEGER NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS tracks_album ON tracks(album_id);
    CREATE INDEX IF NOT EXISTS tracks_artist ON tracks(artist_id);

    CREATE TABLE IF NOT EXISTS playlists (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, position)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      track_id    INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS plays (
      id          INTEGER PRIMARY KEY,
      track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      played_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS plays_time ON plays(played_at);
  `);
  return db;
}
