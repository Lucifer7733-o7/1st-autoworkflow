import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { AlbumGrid } from '../components/CardGrid.jsx';
import TrackList from '../components/TrackList.jsx';
import { Loading } from './common.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night listening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const home = useApi('/home');
  return (
    <div className="page">
      <h1>{greeting()}</h1>
      <Loading state={home}>
        {(d) =>
          !d.recentAlbums.length ? (
            <div className="welcome">
              <h2>Your library is empty</h2>
              <p>
                Put music files in your music folder, then open <Link to="/settings">Library</Link> and press <strong>Rescan</strong>.
              </p>
            </div>
          ) : (
            <>
              {d.recentlyPlayed.length > 0 && (
                <section>
                  <h2>Recently played</h2>
                  <TrackList tracks={d.recentlyPlayed.slice(0, 6)} showAlbum={false} />
                </section>
              )}
              <section>
                <div className="section-head">
                  <h2>Recently added</h2>
                  <Link to="/albums?sort=recent">Show all</Link>
                </div>
                <AlbumGrid albums={d.recentAlbums} />
              </section>
              {d.mostPlayed.length > 0 && (
                <section>
                  <h2>Your top songs</h2>
                  <TrackList tracks={d.mostPlayed} />
                </section>
              )}
            </>
          )
        }
      </Loading>
    </div>
  );
}
