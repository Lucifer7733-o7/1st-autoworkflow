import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { useOverlays } from '../components/Overlays.jsx';
import { MoreIcon } from '../components/Icons.jsx';
import { formatLongDuration, plural } from '../format.js';
import { Loading, PlayButtons } from './common.jsx';

export default function PlaylistPage() {
  const { id } = useParams();
  const playlist = useApi(`/playlists/${id}`);
  const { openMenu, notify } = useOverlays();
  const navigate = useNavigate();
  const { reload, setData } = playlist;

  useEffect(() => {
    window.addEventListener('playlists:changed', reload);
    return () => window.removeEventListener('playlists:changed', reload);
  }, [reload]);

  async function saveOrder(tracks) {
    setData((p) => ({ ...p, tracks, track_count: tracks.length }));
    await api(`/playlists/${id}/tracks`, { method: 'PUT', body: { trackIds: tracks.map((t) => t.id) } });
    window.dispatchEvent(new Event('playlists:changed'));
  }

  function trackMenu(tracks) {
    return (_track, index) => [
      '-',
      index > 0 && {
        label: 'Move up',
        onClick: () => {
          const next = [...tracks];
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          saveOrder(next);
        },
      },
      index < tracks.length - 1 && {
        label: 'Move down',
        onClick: () => {
          const next = [...tracks];
          [next[index + 1], next[index]] = [next[index], next[index + 1]];
          saveOrder(next);
        },
      },
      { label: 'Remove from this playlist', danger: true, onClick: () => saveOrder(tracks.filter((_, i) => i !== index)) },
    ];
  }

  function playlistMenu(p) {
    return [
      {
        label: 'Rename',
        onClick: async () => {
          const name = window.prompt('Playlist name', p.name);
          if (!name?.trim()) return;
          await api(`/playlists/${p.id}`, { method: 'PATCH', body: { name } });
          window.dispatchEvent(new Event('playlists:changed'));
        },
      },
      {
        label: 'Delete playlist',
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${p.name}"? Your songs stay in the library.`)) return;
          await api(`/playlists/${p.id}`, { method: 'DELETE' });
          window.dispatchEvent(new Event('playlists:changed'));
          notify(`Deleted ${p.name}`);
          navigate('/playlists');
        },
      },
    ];
  }

  return (
    <div className="page">
      <Loading state={playlist}>
        {(p) => {
          const coverTrack = p.tracks.find((t) => t.has_cover);
          const duration = p.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
          return (
            <>
              <header className="hero">
                <Cover albumId={coverTrack?.album_id} hasCover={!!coverTrack} name={p.name} className="hero__cover" />
                <div>
                  <span className="eyebrow">Playlist</span>
                  <h1>{p.name}</h1>
                  <p className="muted">
                    {plural(p.tracks.length, 'song')}
                    {duration ? ` · ${formatLongDuration(duration)}` : ''}
                  </p>
                  <div className="actions">
                    <PlayButtons tracks={p.tracks} />
                    <button className="icon-btn" aria-label="Playlist options" onClick={(e) => openMenu(e, playlistMenu(p))}>
                      <MoreIcon size={24} />
                    </button>
                  </div>
                </div>
              </header>
              <TrackList tracks={p.tracks} extraMenu={trackMenu(p.tracks)} emptyText="This playlist is empty. Use “Add to playlist…” from any song's ⋯ menu." />
            </>
          );
        }}
      </Loading>
    </div>
  );
}
