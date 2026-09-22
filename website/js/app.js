import { createScene, PALETTES, timeOfDayFor } from './scene.js';
import { fillTitles, loadPlaylist, playlistIdFrom } from './playlist.js';

const config = window.SITE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`ldr:${key}`);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`ldr:${key}`, JSON.stringify(value));
    } catch {
      /* storage blocked */
    }
  },
};

const fmt = (s) => {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  s = Math.floor(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

// ---- Branding ---------------------------------------------------------------

if (config.siteName) {
  document.title = config.siteName;
  $('brand').textContent = config.siteName;
}
if (config.tagline) $('tagline').textContent = config.tagline;
{
  const links = Object.entries(config.links || {}).filter(([, url]) => url);
  const footer = $('footer');
  for (const [name, url] of links) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = name[0].toUpperCase() + name.slice(1);
    footer.append(a);
  }
  const note = document.createElement('span');
  note.textContent = 'Music plays through YouTube.';
  footer.append(note);
}

// ---- Scenery ----------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = createScene($('scene'), { reducedMotion });
const WEATHER_ICONS = { morning: '🌤️', day: '☀️', golden: '🌅', night: '🌙' };
const WEATHER_ORDER = ['auto', 'morning', 'day', 'golden', 'night'];
let weatherChoice = store.get('weather', config.timeOfDay || 'auto');

function applyWeather() {
  const name = weatherChoice === 'auto' ? timeOfDayFor() : weatherChoice;
  scene.setPalette(name);
  $('weather-icon').textContent = WEATHER_ICONS[name];
  $('weather-label').textContent = weatherChoice === 'auto' ? `Auto · ${PALETTES[name].label}` : PALETTES[name].label;
  document.documentElement.dataset.time = name;
  document.querySelector('meta[name="theme-color"]').content = PALETTES[name].sky[0];
}
$('weather').addEventListener('click', () => {
  weatherChoice = WEATHER_ORDER[(WEATHER_ORDER.indexOf(weatherChoice) + 1) % WEATHER_ORDER.length];
  store.set('weather', weatherChoice);
  applyWeather();
});
applyWeather();
setInterval(() => weatherChoice === 'auto' && applyWeather(), 60_000);

setInterval(() => {
  $('speed').textContent = `${scene.speedKmh} km/h`;
  $('odo').textContent = `${scene.distanceKm.toFixed(1)} km driven`;
}, 250);

// ---- Player state -----------------------------------------------------------

const state = {
  tracks: [],
  order: [], // indexes into tracks, in play order
  pos: 0,
  shuffle: store.get('shuffle', false),
  repeat: store.get('repeat', 'all'), // 'all' | 'one' | 'off'
  playing: false,
  started: false,
  errors: 0,
};
let player = null;
let dragging = false;

const currentIndex = () => state.order[state.pos];
const currentTrack = () => state.tracks[currentIndex()];

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOrder(keepIndex = currentIndex()) {
  const all = state.tracks.map((_, i) => i);
  if (!state.shuffle) {
    state.order = all;
    state.pos = Math.max(0, all.indexOf(keepIndex ?? 0));
  } else {
    const rest = shuffled(all.filter((i) => i !== keepIndex));
    state.order = keepIndex == null ? rest : [keepIndex, ...rest];
    state.pos = 0;
  }
}

function playTrack(index) {
  const track = state.tracks[index];
  if (!track || !player) return;
  state.pos = Math.max(0, state.order.indexOf(index));
  state.started = true;
  document.body.classList.add('is-driving');
  player.loadVideoById(track.id);
  renderNowPlaying();
  renderList();
}

function next(auto = false) {
  if (!state.order.length) return;
  if (state.pos < state.order.length - 1) return playTrack(state.order[state.pos + 1]);
  if (state.repeat === 'off' && auto) {
    state.playing = false;
    scene.setPlaying(false);
    renderControls();
    return;
  }
  if (state.shuffle) {
    state.order = shuffled(state.order);
  }
  playTrack(state.order[0]);
}

function prev() {
  if (player?.getCurrentTime?.() > 3) return player.seekTo(0, true);
  const pos = state.pos > 0 ? state.pos - 1 : state.order.length - 1;
  playTrack(state.order[pos]);
}

function togglePlay() {
  if (!player || !state.tracks.length) return;
  if (!state.started) return playTrack(currentIndex() ?? 0);
  if (state.playing) player.pauseVideo();
  else player.playVideo();
}

// ---- Rendering --------------------------------------------------------------

function renderNowPlaying() {
  const t = currentTrack();
  if (!t) return;
  const n = currentIndex() + 1;
  $('title').textContent = t.title || `Track ${n}`;
  $('artist').textContent = t.channel || 'YouTube';
  if (state.started) document.title = `${t.title || `Track ${n}`} · ${config.siteName || 'Long Drive Radio'}`;
}

function renderControls() {
  document.body.classList.toggle('is-playing', state.playing);
  $('play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  $('live-dot').classList.toggle('on', state.playing);
  $('shuffle').classList.toggle('on', state.shuffle);
  $('shuffle').setAttribute('aria-pressed', String(state.shuffle));
  const repeatLabel = { all: 'Repeat all', one: 'Repeat one', off: 'Repeat off' }[state.repeat];
  $('repeat').classList.toggle('on', state.repeat !== 'off');
  $('repeat').setAttribute('aria-label', repeatLabel);
  $('repeat').title = repeatLabel;
  $('repeat-one').hidden = state.repeat !== 'one';
}

let listFilter = '';
function renderList() {
  const list = $('tracks');
  const q = listFilter.toLowerCase();
  const current = currentIndex();
  const frag = document.createDocumentFragment();
  state.tracks.forEach((t, i) => {
    const title = t.title || `Track ${i + 1}`;
    if (q && !`${title} ${t.channel}`.toLowerCase().includes(q)) return;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `track${i === current && state.started ? ' is-current' : ''}${t.unavailable ? ' is-unavailable' : ''}`;
    btn.addEventListener('click', () => playTrack(i));
    btn.innerHTML = `
      <span class="track__n">${i + 1}</span>
      <img class="track__thumb" loading="lazy" alt="" width="64" height="36" />
      <span class="track__text"><strong></strong><small></small></span>
      <span class="track__time">${t.duration ? fmt(t.duration) : ''}</span>`;
    btn.querySelector('img').src = t.thumb;
    btn.querySelector('strong').textContent = title;
    btn.querySelector('small').textContent = t.unavailable ? 'Unavailable on this site' : t.channel || '';
    li.append(btn);
    frag.append(li);
  });
  list.replaceChildren(frag);
  $('count').textContent = state.tracks.length ? `(${state.tracks.length})` : '';
}

// ---- Playlist drawer ---------------------------------------------------------

function setDrawer(open) {
  $('playlist').hidden = !open;
  $('open-list').setAttribute('aria-expanded', String(open));
  if (open) {
    const cur = $('tracks').querySelector('.is-current');
    cur?.scrollIntoView({ block: 'center' });
  }
}
$('open-list').addEventListener('click', () => setDrawer($('playlist').hidden));
$('close-list').addEventListener('click', () => setDrawer(false));
$('search').addEventListener('input', (e) => {
  listFilter = e.target.value.trim();
  renderList();
});

// ---- Controls ----------------------------------------------------------------

$('play').addEventListener('click', togglePlay);
$('start').addEventListener('click', togglePlay);
$('next').addEventListener('click', () => next());
$('prev').addEventListener('click', prev);
$('shuffle').addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  store.set('shuffle', state.shuffle);
  buildOrder();
  renderControls();
});
$('repeat').addEventListener('click', () => {
  state.repeat = { all: 'one', one: 'off', off: 'all' }[state.repeat];
  store.set('repeat', state.repeat);
  renderControls();
});

const seek = $('seek');
seek.addEventListener('input', () => {
  dragging = true;
  $('elapsed').textContent = fmt(Number(seek.value));
  seek.style.setProperty('--pct', `${(seek.value / (seek.max || 1)) * 100}%`);
});
seek.addEventListener('change', () => {
  player?.seekTo(Number(seek.value), true);
  dragging = false;
});

const volume = $('volume');
function setVolume(v, remember = true) {
  volume.value = v;
  volume.style.setProperty('--pct', `${v}%`);
  document.body.classList.toggle('is-muted', Number(v) === 0);
  player?.setVolume?.(Number(v));
  if (Number(v) > 0) player?.unMute?.();
  if (remember) store.set('volume', Number(v));
}
volume.addEventListener('input', () => setVolume(volume.value));
let lastVolume = store.get('volume', 80) || 80;
$('mute').addEventListener('click', () => {
  if (Number(volume.value) > 0) {
    lastVolume = Number(volume.value);
    setVolume(0);
  } else setVolume(lastVolume || 80);
});
setVolume(store.get('volume', 80), false);

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, button') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'n') next();
  else if (e.key === 'p') prev();
  else if (e.key === 'Escape') setDrawer(false);
});

setInterval(() => {
  if (!player?.getCurrentTime || dragging || !state.started) return;
  const t = player.getCurrentTime() || 0;
  const d = player.getDuration() || currentTrack()?.duration || 0;
  seek.max = Math.floor(d);
  seek.value = Math.floor(t);
  seek.style.setProperty('--pct', `${d ? (t / d) * 100 : 0}%`);
  $('elapsed').textContent = fmt(t);
  $('total').textContent = fmt(d);
}, 500);

// ---- YouTube ------------------------------------------------------------------

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('Could not load YouTube. Check your connection or ad blocker.'));
    document.head.append(s);
  });
}

function status(text, isError = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', isError);
}

async function init() {
  const playlistId = playlistIdFrom(config.playlist);
  if (!playlistId) {
    $('start-label').textContent = 'No playlist set';
    status('Add your YouTube playlist link to config.js.', true);
    return;
  }

  let YT;
  try {
    YT = await loadYouTubeApi();
  } catch (err) {
    $('start-label').textContent = 'YouTube unavailable';
    status(err.message, true);
    return;
  }

  let result;
  try {
    result = await loadPlaylist({ playlistId, apiKey: config.youtubeApiKey, YT });
  } catch (err) {
    $('start-label').textContent = 'Playlist unavailable';
    status(`${err.message}. Make sure the playlist is Public or Unlisted.`, true);
    return;
  }
  state.tracks = result.tracks;
  if (!state.tracks.length) {
    $('start-label').textContent = 'Playlist is empty';
    return;
  }
  buildOrder(state.shuffle ? Math.floor(Math.random() * state.tracks.length) : 0);
  renderList();
  renderNowPlaying();
  renderControls();

  player = new YT.Player('yt', {
    width: '100%',
    height: '100%',
    videoId: currentTrack().id,
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, controls: 1 },
    events: {
      onReady: () => {
        setVolume(volume.value, false);
        $('play').disabled = false;
        $('start').disabled = false;
        $('start-label').textContent = `Start the drive · ${state.tracks.length} songs`;
      },
      onStateChange: (e) => {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          state.playing = true;
          state.started = true;
          state.errors = 0;
          document.body.classList.add('is-driving');
          // The playing video tells us its real title if we did not have one.
          const t = currentTrack();
          const data = player.getVideoData?.();
          if (t && data?.video_id && data.video_id !== t.id) {
            // YouTube switched videos itself (e.g. the user clicked inside the player); follow along.
            const idx = state.tracks.findIndex((x) => x.id === data.video_id);
            if (idx >= 0) state.pos = Math.max(0, state.order.indexOf(idx));
          }
          const cur = currentTrack();
          if (cur && !cur.title && data?.title) {
            cur.title = data.title;
            cur.channel = cur.channel || (data.author || '').replace(/ - Topic$/, '');
            renderList();
          }
          renderNowPlaying();
        } else if (e.data === S.PAUSED) {
          state.playing = false;
        } else if (e.data === S.ENDED) {
          state.playing = false;
          if (state.repeat === 'one') {
            player.seekTo(0, true);
            player.playVideo();
          } else next(true);
        }
        scene.setPlaying(state.playing);
        renderControls();
      },
      onError: () => {
        const t = currentTrack();
        if (t) t.unavailable = true;
        renderList();
        state.errors++;
        if (state.errors >= Math.min(state.tracks.length, 10)) {
          status('YouTube would not play these songs here. Some videos do not allow embedding.', true);
          return;
        }
        setTimeout(() => next(true), 800);
      },
    },
  });

  if (result.source === 'player') {
    fillTitles(state.tracks, () => {
      renderList();
      renderNowPlaying();
    });
  }
}

renderControls();
init();
