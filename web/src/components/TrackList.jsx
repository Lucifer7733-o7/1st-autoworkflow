import { useNavigate } from 'react-router-dom';
import { useFavorites, usePlayer } from '../player.jsx';
import { formatTime } from '../format.js';
import { useOverlays } from './Overlays.jsx';
import Cover from './Cover.jsx';
import { HeartFilledIcon, HeartIcon, MoreIcon, PlayIcon } from './Icons.jsx';

function Equalizer({ playing }) {
  return (
    <span className={`eq ${playing ? 'eq--on' : ''}`} aria-label="Now playing">
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * A list of songs. Clicking a row plays the whole list starting at that song.
 * `showAlbum`/`showCover` control the columns; `extraMenu(track, index)` adds items to the row menu.
 */
export default function TrackList({ tracks, showAlbum = true, showCover = true, numbered = false, extraMenu, emptyText = 'No songs here yet.' }) {
  const player = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { openMenu, pickPlaylist, notify } = useOverlays();
  const navigate = useNavigate();

  if (!tracks?.length) return <p className="empty">{emptyText}</p>;

  function menuFor(track, index) {
    return [
      { label: 'Play next', onClick: () => (player.playNext([track]), notify('Playing next')) },
      { label: 'Add to queue', onClick: () => (player.enqueue([track]), notify('Added to queue')) },
      { label: 'Add to playlist…', onClick: () => pickPlaylist([track]) },
      { label: isFavorite(track) ? 'Remove from Liked Songs' : 'Add to Liked Songs', onClick: () => toggleFavorite(track) },
      '-',
      { label: 'Go to album', onClick: () => navigate(`/albums/${track.album_id}`) },
      { label: 'Go to artist', onClick: () => navigate(`/artists/${track.artist_id}`) },
      ...(extraMenu ? extraMenu(track, index) : []),
    ];
  }

  return (
    <div className={`tracklist ${showAlbum ? '' : 'tracklist--no-album'}`} role="list">
      {tracks.map((track, i) => {
        const isCurrent = player.current?.id === track.id;
        const fav = isFavorite(track);
        return (
          <div
            key={`${track.id}-${i}`}
            role="listitem"
            className={`track ${isCurrent ? 'track--current' : ''}`}
            onClick={() => (isCurrent ? player.toggle() : player.playTracks(tracks, i))}
            onContextMenu={(e) => openMenu(e, menuFor(track, i))}
          >
            <div className="track__num">
              {isCurrent ? <Equalizer playing={player.playing} /> : <span className="track__index">{numbered ? track.track_no || i + 1 : i + 1}</span>}
              <PlayIcon className="track__play" size={16} />
            </div>
            <div className="track__main">
              {showCover && <Cover albumId={track.album_id} hasCover={track.has_cover} name={track.album} size={40} />}
              <div className="track__text">
                <span className="track__title">{track.title}</span>
                <span className="track__artist">{track.artist}</span>
              </div>
            </div>
            {showAlbum && <span className="track__album">{track.album}</span>}
            <button
              className={`icon-btn track__fav ${fav ? 'is-on' : ''}`}
              aria-label={fav ? 'Unlike' : 'Like'}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(track);
              }}
            >
              {fav ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
            </button>
            <span className="track__time">{formatTime(track.duration)}</span>
            <button className="icon-btn track__more" aria-label="More options" onClick={(e) => openMenu(e, menuFor(track, i))}>
              <MoreIcon size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
