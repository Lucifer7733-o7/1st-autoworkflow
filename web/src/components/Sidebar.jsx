import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { AlbumIcon, ArtistIcon, HeartFilledIcon, HomeIcon, ListIcon, MusicIcon, SearchIcon, SettingsIcon } from './Icons.jsx';

const LINKS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true, mobile: true },
  { to: '/search', label: 'Search', icon: SearchIcon, mobile: true },
  { to: '/songs', label: 'Songs', icon: MusicIcon },
  { to: '/albums', label: 'Albums', icon: AlbumIcon, mobile: true },
  { to: '/artists', label: 'Artists', icon: ArtistIcon },
  { to: '/liked', label: 'Liked Songs', icon: HeartFilledIcon },
  { to: '/playlists', label: 'Playlists', icon: ListIcon, mobile: true },
  { to: '/settings', label: 'Library', icon: SettingsIcon, mobile: true },
];

export function Sidebar() {
  const [playlists, setPlaylists] = useState([]);
  useEffect(() => {
    const load = () => api('/playlists').then(setPlaylists).catch(() => {});
    load();
    window.addEventListener('playlists:changed', load);
    return () => window.removeEventListener('playlists:changed', load);
  }, []);

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <img src="/icon.svg" alt="" width={28} height={28} />
        Home Stream
      </div>
      {LINKS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-link">
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
      {playlists.length > 0 && (
        <>
          <h3 className="sidebar__heading">Your playlists</h3>
          <div className="sidebar__playlists">
            {playlists.map((p) => (
              <NavLink key={p.id} to={`/playlists/${p.id}`} className="nav-link nav-link--small">
                {p.name}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {LINKS.filter((l) => l.mobile).map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="tab">
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
