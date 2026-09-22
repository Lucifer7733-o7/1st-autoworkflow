import { useApi } from '../api.js';
import TrackList from '../components/TrackList.jsx';
import { Loading, PlayButtons } from './common.jsx';

export default function Songs() {
  const songs = useApi('/tracks?limit=5000');
  return (
    <div className="page">
      <h1>Songs</h1>
      <Loading state={songs}>
        {(d) => (
          <>
            <p className="muted">{d.total} songs</p>
            <PlayButtons tracks={d.tracks} />
            <TrackList tracks={d.tracks} />
          </>
        )}
      </Loading>
    </div>
  );
}
