import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../api.js';
import Cover from '../components/Cover.jsx';
import { HeartFilledIcon, PlusIcon } from '../components/Icons.jsx';
import { Loading } from './common.jsx';

export default function Playlists() {
  const playlists = useApi('/playlists');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { reload } = playlists;

  useEffect(() => {
    window.addEventListener('playlists:changed', reload);
    return () => window.removeEventListener('playlists:changed', reload);
  }, [reload]);

  async function create(e) {
    e.preventDefault();
    const p = await api('/playlists', { method: 'POST', body: { name } });
    window.dispatchEvent(new Event('playlists:changed'));
    navigate(`/playlists/${p.id}`);
  }

  return (
    <div className="page">
      <h1>Playlists</h1>
      <form className="new-playlist" onSubmit={create}>
        <input placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--primary" disabled={!name.trim()}>
          <PlusIcon size={16} /> Create
        </button>
      </form>
      <div className="grid">
        <Link to="/liked" className="card">
          <div className="cover hero__cover--liked">
            <HeartFilledIcon size={48} />
          </div>
          <strong className="card__title">Liked Songs</strong>
          <span className="card__sub">Auto playlist</span>
        </Link>
        <Loading state={playlists}>
          {(list) =>
            list.map((p) => (
              <Link key={p.id} to={`/playlists/${p.id}`} className="card">
                <Cover albumId={p.cover_album_id} hasCover={!!p.cover_album_id} name={p.name} />
                <strong className="card__title">{p.name}</strong>
                <span className="card__sub">{p.track_count} songs</span>
              </Link>
            ))
          }
        </Loading>
      </div>
    </div>
  );
}
