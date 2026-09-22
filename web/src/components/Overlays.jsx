import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { CloseIcon, PlusIcon } from './Icons.jsx';
import Cover from './Cover.jsx';

const OverlayContext = createContext(null);
export const useOverlays = () => useContext(OverlayContext);

// App-wide popup menu, "add to playlist" dialog and toast messages.
export function OverlayProvider({ children }) {
  const [menu, setMenu] = useState(null); // { x, y, items }
  const [picker, setPicker] = useState(null); // { tracks }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  const openMenu = useCallback((event, items) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect?.();
    const x = event.clientX || rect?.right || 0;
    const y = event.clientY || rect?.bottom || 0;
    setMenu({ x, y, items: items.filter(Boolean) });
  }, []);

  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const pickPlaylist = useCallback((tracks) => setPicker({ tracks }), []);

  return (
    <OverlayContext.Provider value={{ openMenu, notify, pickPlaylist }}>
      {children}
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
      {picker && <PlaylistPicker tracks={picker.tracks} onClose={() => setPicker(null)} notify={notify} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </OverlayContext.Provider>
  );
}

function Menu({ x, y, items, onClose }) {
  const ref = useRef();
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  return (
    <div className="menu" ref={ref} style={pos} role="menu">
      {items.map((item, i) =>
        item === '-' ? (
          <hr key={`sep-${i}`} />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            className={item.danger ? 'danger' : ''}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

function PlaylistPicker({ tracks, onClose, notify }) {
  const [playlists, setPlaylists] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    api('/playlists').then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  const trackIds = tracks.map((t) => t.id);
  const label = tracks.length === 1 ? `"${tracks[0].title}"` : `${tracks.length} songs`;

  async function addTo(playlist) {
    await api(`/playlists/${playlist.id}/tracks`, { method: 'POST', body: { trackIds } });
    notify(`Added ${label} to ${playlist.name}`);
    window.dispatchEvent(new Event('playlists:changed'));
    onClose();
  }

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const playlist = await api('/playlists', { method: 'POST', body: { name, trackIds } });
    notify(`Created ${playlist.name}`);
    window.dispatchEvent(new Event('playlists:changed'));
    onClose();
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Add to playlist">
        <header>
          <h2>Add {label} to playlist</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <form className="new-playlist" onSubmit={create}>
          <input autoFocus placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn--primary" disabled={!name.trim()}>
            <PlusIcon size={16} /> Create
          </button>
        </form>
        <div className="picker-list">
          {playlists === null && <p className="muted">Loading…</p>}
          {playlists?.length === 0 && <p className="muted">No playlists yet. Create one above.</p>}
          {playlists?.map((p) => (
            <button key={p.id} className="picker-item" onClick={() => addTo(p)}>
              <Cover albumId={p.cover_album_id} hasCover={!!p.cover_album_id} name={p.name} size={40} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.track_count} songs</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
