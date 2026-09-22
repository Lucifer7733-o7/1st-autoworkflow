import { usePlayer } from '../player.jsx';
import { formatTime } from '../format.js';
import Cover from './Cover.jsx';
import { CloseIcon, DownIcon, UpIcon } from './Icons.jsx';

export default function QueuePanel({ onClose }) {
  const p = usePlayer();
  const upcoming = p.queue.slice(p.index + 1);

  const row = (item, i) => (
    <li key={item.key} className={`queue__item ${i === p.index ? 'is-current' : ''}`}>
      <button className="queue__play" onClick={() => p.jump(i)}>
        <Cover albumId={item.track.album_id} hasCover={item.track.has_cover} name={item.track.album} size={40} />
        <span className="queue__text">
          <strong>{item.track.title}</strong>
          <small>
            {item.track.artist} · {formatTime(item.track.duration)}
          </small>
        </span>
      </button>
      {i !== p.index && (
        <span className="queue__actions">
          <button className="icon-btn" aria-label="Move up" onClick={() => p.move(i, i - 1)} disabled={i <= p.index + 1}>
            <UpIcon size={16} />
          </button>
          <button className="icon-btn" aria-label="Move down" onClick={() => p.move(i, i + 1)} disabled={i === p.queue.length - 1}>
            <DownIcon size={16} />
          </button>
          <button className="icon-btn" aria-label="Remove from queue" onClick={() => p.remove(i)}>
            <CloseIcon size={16} />
          </button>
        </span>
      )}
    </li>
  );

  return (
    <aside className="queue" aria-label="Queue">
      <header>
        <h2>Queue</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close queue">
          <CloseIcon />
        </button>
      </header>
      {!p.current ? (
        <p className="empty">Nothing is playing.</p>
      ) : (
        <>
          <h3>Now playing</h3>
          <ul>{row(p.queue[p.index], p.index)}</ul>
          <div className="queue__next-head">
            <h3>Next up {p.shuffle && <span className="pill">shuffled</span>}</h3>
            {upcoming.length > 0 && (
              <button className="link-btn" onClick={p.clearUpcoming}>
                Clear
              </button>
            )}
          </div>
          {upcoming.length ? <ul>{upcoming.map((item, j) => row(item, p.index + 1 + j))}</ul> : <p className="empty">End of queue.</p>}
        </>
      )}
    </aside>
  );
}
