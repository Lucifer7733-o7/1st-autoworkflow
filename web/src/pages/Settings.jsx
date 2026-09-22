import { useEffect, useState } from 'react';
import { api, useApi } from '../api.js';
import { formatLongDuration } from '../format.js';

export default function Settings({ authEnabled }) {
  const stats = useApi('/stats');
  const [scan, setScan] = useState(null);
  const [error, setError] = useState(null);
  const reloadStats = stats.reload;

  useEffect(() => {
    let timer;
    let stopped = false;
    const poll = async () => {
      try {
        const s = await api('/scan');
        if (stopped) return;
        setScan((prev) => {
          if (prev?.running && !s.running) reloadStats();
          return s;
        });
        timer = setTimeout(poll, s.running ? 1000 : 10000);
      } catch {
        /* ignore */
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reloadStats]);

  async function rescan() {
    setError(null);
    try {
      await api('/scan', { method: 'POST' });
      setScan((s) => ({ ...s, running: true }));
      setTimeout(async () => setScan(await api('/scan')), 500);
    } catch (e) {
      setError(e.message);
    }
  }

  async function logout() {
    await api('/logout', { method: 'POST' });
    window.location.reload();
  }

  const last = scan?.last;
  return (
    <div className="page page--narrow">
      <h1>Library</h1>
      {stats.data && (
        <div className="stats">
          <div>
            <strong>{stats.data.tracks}</strong>
            <span>songs</span>
          </div>
          <div>
            <strong>{stats.data.albums}</strong>
            <span>albums</span>
          </div>
          <div>
            <strong>{stats.data.artists}</strong>
            <span>artists</span>
          </div>
          <div>
            <strong>{formatLongDuration(stats.data.duration)}</strong>
            <span>of music</span>
          </div>
        </div>
      )}

      <section className="panel">
        <h2>Music folder</h2>
        <p>
          <code>{scan?.musicDir || '…'}</code>
        </p>
        <p className="muted">Add, remove or re-tag files in this folder, then rescan. Only changed files are re-read, so rescans are quick.</p>
        <button className="btn btn--primary" onClick={rescan} disabled={scan?.running}>
          {scan?.running ? 'Scanning…' : 'Rescan library'}
        </button>
        {error && <p className="error">{error}</p>}
        {last && !scan.running && (
          <p className="muted">
            Last scan {new Date(last.finishedAt).toLocaleString()}: {last.added} added, {last.updated} updated, {last.removed} removed
            {last.errors.length ? `, ${last.errors.length} unreadable` : ''}.
          </p>
        )}
        {last?.errors?.length > 0 && (
          <details>
            <summary>Files that could not be read</summary>
            <ul className="error-list">
              {last.errors.slice(0, 50).map((e) => (
                <li key={e.path}>
                  <code>{e.path}</code>: {e.error}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="panel">
        <h2>Install on your phone</h2>
        <p className="muted">
          Open this site in your phone's browser and choose <strong>Add to Home screen</strong> (Android: browser menu; iPhone: Share
          button). It then opens like an app and shows controls on the lock screen.
        </p>
      </section>

      {authEnabled && (
        <section className="panel">
          <h2>Account</h2>
          <button className="btn" onClick={logout}>
            Log out
          </button>
        </section>
      )}
    </div>
  );
}
