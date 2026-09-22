import { Link } from 'react-router-dom';
import Cover from './Cover.jsx';

export function AlbumGrid({ albums, emptyText = 'No albums yet.' }) {
  if (!albums?.length) return <p className="empty">{emptyText}</p>;
  return (
    <div className="grid">
      {albums.map((a) => (
        <Link key={a.id} to={`/albums/${a.id}`} className="card">
          <Cover albumId={a.id} hasCover={a.has_cover} name={a.title} />
          <strong className="card__title">{a.title}</strong>
          <span className="card__sub">
            {a.artist}
            {a.year ? ` · ${a.year}` : ''}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ArtistGrid({ artists, emptyText = 'No artists yet.' }) {
  if (!artists?.length) return <p className="empty">{emptyText}</p>;
  return (
    <div className="grid">
      {artists.map((a) => (
        <Link key={a.id} to={`/artists/${a.id}`} className="card card--artist">
          <Cover albumId={a.cover_album_id} hasCover={!!a.cover_album_id} name={a.name} round />
          <strong className="card__title">{a.name}</strong>
          {a.album_count != null && <span className="card__sub">{a.album_count === 1 ? '1 album' : `${a.album_count} albums`}</span>}
        </Link>
      ))}
    </div>
  );
}
