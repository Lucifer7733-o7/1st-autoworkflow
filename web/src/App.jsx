import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { PlayerProvider, usePlayer } from './player.jsx';
import { OverlayProvider } from './components/Overlays.jsx';
import { Sidebar, TabBar } from './components/Sidebar.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import QueuePanel from './components/QueuePanel.jsx';
import Home from './pages/Home.jsx';
import Songs from './pages/Songs.jsx';
import Albums from './pages/Albums.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import Artists from './pages/Artists.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import Search from './pages/Search.jsx';
import Liked from './pages/Liked.jsx';
import Playlists from './pages/Playlists.jsx';
import PlaylistPage from './pages/PlaylistPage.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';

function ScrollToTop({ element }) {
  const { pathname } = useLocation();
  useEffect(() => element?.scrollTo(0, 0), [pathname, element]);
  return null;
}

function KeyboardShortcuts() {
  const { toggle, next, prev } = usePlayer();
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, button, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'n') next();
      else if (e.key === 'p') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev]);
  return null;
}

function Shell({ authEnabled }) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [main, setMain] = useState(null);

  return (
    <div className={`app ${queueOpen ? 'app--queue' : ''}`}>
      <Sidebar />
      <main className="main" ref={setMain}>
        <ScrollToTop element={main} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/songs" element={<Songs />} />
          <Route path="/albums" element={<Albums />} />
          <Route path="/albums/:id" element={<AlbumPage />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/:id" element={<ArtistPage />} />
          <Route path="/liked" element={<Liked />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlists/:id" element={<PlaylistPage />} />
          <Route path="/settings" element={<Settings authEnabled={authEnabled} />} />
          <Route path="*" element={<p className="empty page">Page not found.</p>} />
        </Routes>
      </main>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      <PlayerBar queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((o) => !o)} />
      <TabBar />
      <KeyboardShortcuts />
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);

  const check = useCallback(() => {
    api('/me')
      .then(setAuth)
      .catch(() => setAuth({ authEnabled: true, loggedIn: false, offline: true }));
  }, []);

  useEffect(() => {
    check();
    const onRequired = () => setAuth((a) => ({ ...a, loggedIn: false }));
    window.addEventListener('auth:required', onRequired);
    return () => window.removeEventListener('auth:required', onRequired);
  }, [check]);

  if (!auth) return <div className="spinner spinner--page" aria-label="Loading" />;
  if (auth.offline) {
    return (
      <div className="login">
        <form onSubmit={(e) => (e.preventDefault(), check())}>
          <h1>Can't reach the server</h1>
          <p className="muted">Check that Home Stream is running, then try again.</p>
          <button className="btn btn--primary">Retry</button>
        </form>
      </div>
    );
  }
  if (!auth.loggedIn) return <Login onLogin={check} />;

  return (
    <BrowserRouter>
      <PlayerProvider>
        <OverlayProvider>
          <Shell authEnabled={auth.authEnabled} />
        </OverlayProvider>
      </PlayerProvider>
    </BrowserRouter>
  );
}
