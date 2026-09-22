import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFavorites, usePlayer, usePlayerTime } from '../player.jsx';
import { formatTime } from '../format.js';
import Cover from './Cover.jsx';
import {
  ChevronDownIcon,
  HeartFilledIcon,
  HeartIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons.jsx';

function SeekBar() {
  const { seek, current } = usePlayer();
  const { currentTime, duration } = usePlayerTime();
  const [drag, setDrag] = useState(null);
  const value = drag ?? currentTime;
  const pct = duration ? (value / duration) * 100 : 0;
  return (
    <div className="seek">
      <span className="seek__time">{formatTime(value)}</span>
      <input
        type="range"
        className="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(value, duration || 0)}
        disabled={!current}
        style={{ '--pct': `${pct}%` }}
        aria-label="Seek"
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => drag != null && (seek(drag), setDrag(null))}
        onKeyUp={() => drag != null && (seek(drag), setDrag(null))}
      />
      <span className="seek__time">{formatTime(duration)}</span>
    </div>
  );
}

function Controls({ big = false }) {
  const p = usePlayer();
  const size = big ? 28 : 18;
  const repeatLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[p.repeat];
  return (
    <div className={`controls ${big ? 'controls--big' : ''}`}>
      <button className={`icon-btn toggle ${p.shuffle ? 'is-on' : ''}`} onClick={p.toggleShuffle} aria-label="Shuffle" aria-pressed={p.shuffle} title="Shuffle">
        <ShuffleIcon size={size} />
      </button>
      <button className="icon-btn" onClick={p.prev} aria-label="Previous" disabled={!p.current}>
        <PrevIcon size={size + 2} />
      </button>
      <button className="play-btn" onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} disabled={!p.current}>
        {p.playing ? <PauseIcon size={big ? 30 : 20} /> : <PlayIcon size={big ? 30 : 20} />}
      </button>
      <button className="icon-btn" onClick={p.next} aria-label="Next" disabled={!p.current}>
        <NextIcon size={size + 2} />
      </button>
      <button className={`icon-btn toggle ${p.repeat !== 'off' ? 'is-on' : ''}`} onClick={p.cycleRepeat} aria-label={repeatLabel} title={repeatLabel}>
        <RepeatIcon size={size} />
        {p.repeat === 'one' && <span className="repeat-one">1</span>}
      </button>
    </div>
  );
}

function Volume() {
  const { volume, setVolume } = usePlayer();
  const lastVolume = useRef(1);
  return (
    <div className="volume">
      <button
        className="icon-btn"
        aria-label={volume ? 'Mute' : 'Unmute'}
        onClick={() => {
          if (volume) {
            lastVolume.current = volume;
            setVolume(0);
          } else setVolume(lastVolume.current || 1);
        }}
      >
        {volume ? <VolumeIcon size={18} /> : <MuteIcon size={18} />}
      </button>
      <input
        type="range"
        className="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        style={{ '--pct': `${volume * 100}%` }}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
      />
    </div>
  );
}

function FavButton({ track, size = 18 }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(track);
  return (
    <button className={`icon-btn ${fav ? 'is-on' : ''}`} onClick={() => toggleFavorite(track)} aria-label={fav ? 'Unlike' : 'Like'}>
      {fav ? <HeartFilledIcon size={size} /> : <HeartIcon size={size} />}
    </button>
  );
}

// Full-screen "now playing" view, used on phones.
function NowPlaying({ onClose, onQueue }) {
  const { current } = usePlayer();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!current) return null;
  return (
    <div className="now-playing">
      <header>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <ChevronDownIcon size={28} />
        </button>
        <span>Now playing</span>
        <button className="icon-btn" onClick={onQueue} aria-label="Queue">
          <QueueIcon size={22} />
        </button>
      </header>
      <Cover albumId={current.album_id} hasCover={current.has_cover} name={current.album} className="now-playing__cover" />
      <div className="now-playing__meta">
        <div>
          <h2>{current.title}</h2>
          <Link to={`/artists/${current.artist_id}`} onClick={onClose}>
            {current.artist}
          </Link>
        </div>
        <FavButton track={current} size={26} />
      </div>
      <SeekBar />
      <Controls big />
    </div>
  );
}

export default function PlayerBar({ onToggleQueue, queueOpen }) {
  const { current, playing, toggle } = usePlayer();
  const { currentTime, duration } = usePlayerTime();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <footer className={`player ${current ? '' : 'player--empty'}`}>
        <div className="player__progress" style={{ width: duration ? `${(currentTime / duration) * 100}%` : 0 }} />
        <div className="player__now" onClick={() => current && window.matchMedia('(max-width: 760px)').matches && setExpanded(true)}>
          {current ? (
            <>
              <Cover albumId={current.album_id} hasCover={current.has_cover} name={current.album} size={52} />
              <div className="player__text">
                <Link to={`/albums/${current.album_id}`} className="player__title" onClick={(e) => e.stopPropagation()}>
                  {current.title}
                </Link>
                <Link to={`/artists/${current.artist_id}`} className="player__artist" onClick={(e) => e.stopPropagation()}>
                  {current.artist}
                </Link>
              </div>
              <span className="player__fav" onClick={(e) => e.stopPropagation()}>
                <FavButton track={current} />
              </span>
            </>
          ) : (
            <span className="muted">Pick something to play</span>
          )}
        </div>
        <div className="player__center">
          <Controls />
          <SeekBar />
        </div>
        <div className="player__right">
          <button className={`icon-btn toggle ${queueOpen ? 'is-on' : ''}`} onClick={onToggleQueue} aria-label="Queue" title="Queue">
            <QueueIcon size={18} />
          </button>
          <Volume />
        </div>
        <button className="play-btn player__mobile-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} disabled={!current}>
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
      </footer>
      {expanded && (
        <NowPlaying
          onClose={() => setExpanded(false)}
          onQueue={() => {
            setExpanded(false);
            onToggleQueue();
          }}
        />
      )}
    </>
  );
}
