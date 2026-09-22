import { useState } from 'react';
import { coverUrl } from '../api.js';

// Stable, pleasant fallback colours derived from the name.
function hue(text = '') {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function Cover({ albumId, hasCover = true, name = '', size, round = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  const cls = `cover ${round ? 'cover--round' : ''} ${className}`;
  if (albumId && hasCover && !failed) {
    return <img className={cls} style={style} src={coverUrl(albumId)} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  const h = hue(name);
  return (
    <div
      className={`${cls} cover--placeholder`}
      style={{ ...style, background: `linear-gradient(135deg, hsl(${h} 55% 45%), hsl(${(h + 60) % 360} 50% 25%))` }}
      aria-hidden="true"
    >
      <span>{name.trim().charAt(0).toUpperCase() || '♪'}</span>
    </div>
  );
}
