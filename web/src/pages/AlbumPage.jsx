import { Link, useParams } from 'react-router-dom';
import { useApi } from '../api.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { formatLongDuration, plural } from '../format.js';
import { Loading, PlayButtons } from './common.jsx';

export default function AlbumPage() {
  const { id } = useParams();
  const album = useApi(`/albums/${id}`);
  return (
    <div className="page">
      <Loading state={album}>
        {(a) => (
          <>
            <header className="hero">
              <Cover albumId={a.id} hasCover={a.has_cover} name={a.title} className="hero__cover" />
              <div>
                <span className="eyebrow">Album</span>
                <h1>{a.title}</h1>
                <p className="muted">
                  <Link to={`/artists/${a.artist_id}`}>{a.artist}</Link>
                  {a.year ? ` · ${a.year}` : ''} · {plural(a.track_count, 'song')} · {formatLongDuration(a.duration)}
                </p>
                <PlayButtons tracks={a.tracks} />
              </div>
            </header>
            <TrackList tracks={a.tracks} showAlbum={false} showCover={false} numbered />
          </>
        )}
      </Loading>
    </div>
  );
}
