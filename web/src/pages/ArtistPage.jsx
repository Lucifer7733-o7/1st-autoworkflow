import { useParams } from 'react-router-dom';
import { useApi } from '../api.js';
import Cover from '../components/Cover.jsx';
import { AlbumGrid } from '../components/CardGrid.jsx';
import TrackList from '../components/TrackList.jsx';
import { plural } from '../format.js';
import { Loading, PlayButtons } from './common.jsx';

export default function ArtistPage() {
  const { id } = useParams();
  const artist = useApi(`/artists/${id}`);
  return (
    <div className="page">
      <Loading state={artist}>
        {(a) => {
          const coverAlbum = a.albums.find((al) => al.has_cover);
          return (
            <>
              <header className="hero">
                <Cover albumId={coverAlbum?.id} hasCover={!!coverAlbum} name={a.name} round className="hero__cover" />
                <div>
                  <span className="eyebrow">Artist</span>
                  <h1>{a.name}</h1>
                  <p className="muted">
                    {plural(a.albums.length, 'album')} · {plural(a.tracks.length, 'song')}
                  </p>
                  <PlayButtons tracks={a.tracks} />
                </div>
              </header>
              {a.albums.length > 0 && (
                <section>
                  <h2>Albums</h2>
                  <AlbumGrid albums={a.albums} />
                </section>
              )}
              <section>
                <h2>Songs</h2>
                <TrackList tracks={a.tracks} />
              </section>
            </>
          );
        }}
      </Loading>
    </div>
  );
}
