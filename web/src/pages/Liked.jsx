import { useApi } from '../api.js';
import TrackList from '../components/TrackList.jsx';
import { plural } from '../format.js';
import { HeartFilledIcon } from '../components/Icons.jsx';
import { Loading, PlayButtons } from './common.jsx';

export default function Liked() {
  const liked = useApi('/favorites');
  return (
    <div className="page">
      <Loading state={liked}>
        {(tracks) => (
          <>
            <header className="hero">
              <div className="hero__cover hero__cover--liked">
                <HeartFilledIcon size={64} />
              </div>
              <div>
                <span className="eyebrow">Playlist</span>
                <h1>Liked Songs</h1>
                <p className="muted">{plural(tracks.length, 'song')}</p>
                <PlayButtons tracks={tracks} />
              </div>
            </header>
            <TrackList tracks={tracks} emptyText="Songs you like will appear here. Tap the heart on any song." />
          </>
        )}
      </Loading>
    </div>
  );
}
