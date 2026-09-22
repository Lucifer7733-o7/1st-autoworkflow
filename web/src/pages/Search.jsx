import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api.js';
import { AlbumGrid, ArtistGrid } from '../components/CardGrid.jsx';
import TrackList from '../components/TrackList.jsx';
import { SearchIcon } from '../components/Icons.jsx';
import { Loading } from './common.jsx';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') || '');
  const q = params.get('q') || '';

  // Debounce typing before updating the URL (and fetching).
  useEffect(() => {
    const id = setTimeout(() => {
      if (text.trim() !== q) setParams(text.trim() ? { q: text.trim() } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [text, q, setParams]);

  const results = useApi(q ? `/search?q=${encodeURIComponent(q)}` : null);

  return (
    <div className="page">
      <label className="searchbox">
        <SearchIcon size={20} />
        <input autoFocus type="search" placeholder="Songs, albums or artists" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {!q ? (
        <p className="empty">Start typing to search your library.</p>
      ) : (
        <Loading state={results}>
          {(r) =>
            !r.tracks.length && !r.albums.length && !r.artists.length ? (
              <p className="empty">No results for “{q}”.</p>
            ) : (
              <>
                {r.tracks.length > 0 && (
                  <section>
                    <h2>Songs</h2>
                    <TrackList tracks={r.tracks} />
                  </section>
                )}
                {r.artists.length > 0 && (
                  <section>
                    <h2>Artists</h2>
                    <ArtistGrid artists={r.artists} />
                  </section>
                )}
                {r.albums.length > 0 && (
                  <section>
                    <h2>Albums</h2>
                    <AlbumGrid albums={r.albums} />
                  </section>
                )}
              </>
            )
          }
        </Loading>
      )}
    </div>
  );
}
