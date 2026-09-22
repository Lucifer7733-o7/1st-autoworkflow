import { usePlayer } from '../player.jsx';
import { PlayIcon, ShuffleIcon } from '../components/Icons.jsx';

export function Loading({ state, children }) {
  if (state.error) {
    return <p className="empty">{state.error.status === 404 ? 'Not found.' : `Something went wrong: ${state.error.message}`}</p>;
  }
  if (!state.data) return <div className="spinner" aria-label="Loading" />;
  return children(state.data);
}

export function PlayButtons({ tracks }) {
  const { playTracks, shuffleTracks } = usePlayer();
  if (!tracks?.length) return null;
  return (
    <div className="actions">
      <button className="btn btn--primary btn--round" onClick={() => playTracks(tracks, 0, { shuffle: false })}>
        <PlayIcon size={18} /> Play
      </button>
      <button className="btn" onClick={() => shuffleTracks(tracks)}>
        <ShuffleIcon size={18} /> Shuffle
      </button>
    </div>
  );
}
