import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api, coverUrl, streamUrl } from './api.js';

const PlayerContext = createContext(null);
const TimeContext = createContext({ currentTime: 0, duration: 0 });
const FavoritesContext = createContext(null);

const STORAGE_KEY = 'home-stream:player';
const MAX_SAVED_QUEUE = 1000;

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Queue items are wrapped so the same track can appear twice and shuffle can restore the original order.
let nextKey = 1;
const wrap = (tracks) => tracks.map((track) => ({ key: nextKey++, track }));

const initialState = {
  queue: [], // [{ key, track }] in play order
  original: null, // unshuffled order while shuffle is on
  index: -1,
  playing: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  volume: 1,
  loadKey: 0, // bumps whenever a (new) item must be loaded into <audio>
  resumeAt: 0,
};

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.queue?.length) return { ...initialState, ...saved, queue: [], index: -1 };
    const queue = wrap(saved.queue);
    return {
      ...initialState,
      queue,
      index: Math.min(saved.index ?? 0, queue.length - 1),
      shuffle: false,
      repeat: saved.repeat || 'off',
      volume: saved.volume ?? 1,
      resumeAt: saved.position || 0,
    };
  } catch {
    return initialState;
  }
}

function reducer(s, a) {
  switch (a.type) {
    case 'play': {
      if (!a.tracks.length) return s;
      let queue = wrap(a.tracks);
      let index = Math.max(0, Math.min(a.index ?? 0, queue.length - 1));
      let original = null;
      const shuffle = a.shuffle ?? s.shuffle;
      if (shuffle) {
        original = queue;
        const start = a.index == null ? Math.floor(Math.random() * queue.length) : index;
        queue = [queue[start], ...shuffled(queue.filter((_, i) => i !== start))];
        index = 0;
      }
      return { ...s, queue, original, index, shuffle, playing: true, loadKey: s.loadKey + 1, resumeAt: 0 };
    }
    case 'playNext':
    case 'enqueue': {
      const items = wrap(a.tracks);
      if (!s.queue.length) return reducer(s, { type: 'play', tracks: a.tracks, index: 0 });
      const at = a.type === 'playNext' ? s.index + 1 : s.queue.length;
      const queue = [...s.queue.slice(0, at), ...items, ...s.queue.slice(at)];
      const original = s.original && [...s.original, ...items];
      return { ...s, queue, original };
    }
    case 'jump':
      return { ...s, index: a.index, playing: true, loadKey: s.loadKey + 1, resumeAt: 0 };
    case 'next': {
      if (s.index < s.queue.length - 1) return reducer(s, { type: 'jump', index: s.index + 1 });
      if (s.repeat === 'all' && s.queue.length) return reducer(s, { type: 'jump', index: 0 });
      // End of the queue: stop, and rewind to the start if this was the natural end of the last song.
      return a.auto ? { ...s, playing: false, index: 0, loadKey: s.loadKey + 1, resumeAt: 0 } : s;
    }
    case 'prev': {
      if (s.index > 0) return reducer(s, { type: 'jump', index: s.index - 1 });
      if (s.repeat === 'all' && s.queue.length) return reducer(s, { type: 'jump', index: s.queue.length - 1 });
      return reducer(s, { type: 'jump', index: 0 });
    }
    case 'remove': {
      const item = s.queue[a.index];
      if (!item) return s;
      const queue = s.queue.filter((_, i) => i !== a.index);
      const original = s.original && s.original.filter((x) => x !== item);
      if (!queue.length) return { ...s, queue, original: null, index: -1, playing: false };
      if (a.index < s.index) return { ...s, queue, original, index: s.index - 1 };
      if (a.index > s.index) return { ...s, queue, original };
      // Removed the current song: move on to whatever took its place.
      return { ...s, queue, original, index: Math.min(s.index, queue.length - 1), loadKey: s.loadKey + 1, resumeAt: 0 };
    }
    case 'move': {
      const { from, to } = a;
      if (to < 0 || to >= s.queue.length) return s;
      const queue = [...s.queue];
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      const current = s.queue[s.index];
      return { ...s, queue, index: queue.indexOf(current) };
    }
    case 'clearUpcoming':
      return { ...s, queue: s.queue.slice(0, s.index + 1), original: null };
    case 'toggleShuffle': {
      const current = s.queue[s.index];
      if (!s.shuffle) {
        if (!current) return { ...s, shuffle: true };
        const rest = shuffled(s.queue.filter((_, i) => i !== s.index));
        return { ...s, shuffle: true, original: s.queue, queue: [current, ...rest], index: 0 };
      }
      if (!s.original) return { ...s, shuffle: false };
      return { ...s, shuffle: false, queue: s.original, original: null, index: Math.max(0, s.original.indexOf(current)) };
    }
    case 'cycleRepeat':
      return { ...s, repeat: { off: 'all', all: 'one', one: 'off' }[s.repeat] };
    case 'setPlaying':
      return s.queue.length ? { ...s, playing: a.playing } : s;
    case 'volume':
      return { ...s, volume: a.volume };
    default:
      return s;
  }
}

// play() rejects with AbortError when a newer load interrupts it; only a real refusal (autoplay block) means paused.
function tryPlay(audio, dispatch) {
  audio.play().catch((err) => {
    if (err?.name !== 'AbortError') dispatch({ type: 'setPlaying', playing: false });
  });
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadSaved);
  const [time, setTime] = useState({ currentTime: state.resumeAt, duration: 0 });
  const audioRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const playLogged = useRef(false);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const current = state.queue[state.index]?.track ?? null;

  // Load a new song whenever loadKey changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!current) {
      audio.removeAttribute('src');
      audio.load();
      return;
    }
    playLogged.current = false;
    audio.src = streamUrl(current.id);
    const resumeAt = stateRef.current.resumeAt;
    if (resumeAt) {
      audio.addEventListener('loadedmetadata', () => (audio.currentTime = resumeAt), { once: true });
    }
    setTime({ currentTime: resumeAt, duration: current.duration || 0 });
    if (stateRef.current.playing) tryPlay(audio, dispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loadKey, current?.id]);

  // Keep <audio> in sync with the play/pause state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio.src) return;
    if (state.playing && audio.paused) tryPlay(audio, dispatch);
    if (!state.playing && !audio.paused) audio.pause();
  }, [state.playing]);

  useEffect(() => {
    audioRef.current.volume = state.volume;
  }, [state.volume]);

  // Audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => {
      setTime({ currentTime: audio.currentTime, duration: audio.duration || stateRef.current.queue[stateRef.current.index]?.track.duration || 0 });
      // Count a play after 30 seconds (or half of a short song).
      const track = stateRef.current.queue[stateRef.current.index]?.track;
      if (track && !playLogged.current && audio.currentTime >= Math.min(30, (audio.duration || 60) / 2)) {
        playLogged.current = true;
        api(`/plays/${track.id}`, { method: 'POST' }).catch(() => {});
      }
    };
    const onEnded = () => {
      if (stateRef.current.repeat === 'one') {
        audio.currentTime = 0;
        playLogged.current = false;
        tryPlay(audio, dispatch);
      } else {
        dispatch({ type: 'next', auto: true });
      }
    };
    const onPlay = () => dispatch({ type: 'setPlaying', playing: true });
    const onPause = () => !audio.ended && dispatch({ type: 'setPlaying', playing: false });
    const onError = () => {
      if (!audio.getAttribute('src')) return;
      console.warn('Could not play this file, skipping.');
      dispatch({ type: 'next', auto: true });
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const seek = useCallback((t) => {
    const audio = audioRef.current;
    if (!audio.src || !Number.isFinite(t)) return;
    audio.currentTime = Math.max(0, t);
    setTime((x) => ({ ...x, currentTime: audio.currentTime }));
  }, []);

  const actions = useMemo(
    () => ({
      playTracks: (tracks, index = 0, opts = {}) => dispatch({ type: 'play', tracks, index, ...opts }),
      shuffleTracks: (tracks) => dispatch({ type: 'play', tracks, index: null, shuffle: true }),
      playNext: (tracks) => dispatch({ type: 'playNext', tracks }),
      enqueue: (tracks) => dispatch({ type: 'enqueue', tracks }),
      jump: (index) => dispatch({ type: 'jump', index }),
      toggle: () => dispatch({ type: 'setPlaying', playing: !stateRef.current.playing }),
      next: () => dispatch({ type: 'next' }),
      prev: () => {
        if (audioRef.current.currentTime > 3) seek(0);
        else dispatch({ type: 'prev' });
      },
      remove: (index) => dispatch({ type: 'remove', index }),
      move: (from, to) => dispatch({ type: 'move', from, to }),
      clearUpcoming: () => dispatch({ type: 'clearUpcoming' }),
      toggleShuffle: () => dispatch({ type: 'toggleShuffle' }),
      cycleRepeat: () => dispatch({ type: 'cycleRepeat' }),
      setVolume: (volume) => dispatch({ type: 'volume', volume }),
      seek,
    }),
    [seek],
  );

  // Lock-screen / headphone controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = current
      ? new MediaMetadata({
          title: current.title,
          artist: current.artist,
          album: current.album,
          artwork: current.has_cover ? [{ src: coverUrl(current.album_id), sizes: '512x512' }] : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
        })
      : null;
    document.title = current ? `${current.title} · ${current.artist}` : 'Home Stream';
  }, [current]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers = {
      play: () => dispatch({ type: 'setPlaying', playing: true }),
      pause: () => dispatch({ type: 'setPlaying', playing: false }),
      previoustrack: actions.prev,
      nexttrack: actions.next,
      seekto: (d) => actions.seek(d.seekTime),
      seekbackward: (d) => actions.seek(audioRef.current.currentTime - (d.seekOffset || 10)),
      seekforward: (d) => actions.seek(audioRef.current.currentTime + (d.seekOffset || 10)),
    };
    for (const [name, fn] of Object.entries(handlers)) {
      try {
        ms.setActionHandler(name, fn);
      } catch {
        /* unsupported action */
      }
    }
  }, [actions]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
  }, [state.playing]);

  // Remember the queue and position across reloads.
  useEffect(() => {
    const save = () => {
      const s = stateRef.current;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            queue: s.queue.slice(0, MAX_SAVED_QUEUE).map((x) => x.track),
            index: s.index,
            repeat: s.repeat,
            volume: s.volume,
            position: audioRef.current?.currentTime || 0,
          }),
        );
      } catch {
        /* storage full or blocked */
      }
    };
    const id = setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  const value = useMemo(() => ({ ...state, current, ...actions }), [state, current, actions]);
  return (
    <PlayerContext.Provider value={value}>
      <TimeContext.Provider value={time}>
        <FavoritesProvider>{children}</FavoritesProvider>
      </TimeContext.Provider>
    </PlayerContext.Provider>
  );
}

// Favorite flags come with each track from the API; local toggles override them app-wide.
function FavoritesProvider({ children }) {
  const [overrides, setOverrides] = useState(() => new Map());
  const value = useMemo(
    () => ({
      isFavorite: (track) => (overrides.has(track.id) ? overrides.get(track.id) : !!track.favorite),
      toggleFavorite: async (track) => {
        const next = !(overrides.has(track.id) ? overrides.get(track.id) : track.favorite);
        setOverrides((m) => new Map(m).set(track.id, next));
        try {
          await api(`/favorites/${track.id}`, { method: next ? 'PUT' : 'DELETE' });
        } catch {
          setOverrides((m) => new Map(m).set(track.id, !next));
        }
      },
    }),
    [overrides],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const usePlayer = () => useContext(PlayerContext);
export const usePlayerTime = () => useContext(TimeContext);
export const useFavorites = () => useContext(FavoritesContext);
