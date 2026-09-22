// Loads the playlist's songs. Tries, in order:
//   1. the YouTube Data API (live) when an API key is configured,
//   2. playlist.json (written by the scheduled GitHub Action, see scripts/sync-playlist.mjs),
//   3. YouTube's embedded player, which can list a public playlist's videos without any key.

export function playlistIdFrom(value = '') {
  const text = String(value).trim();
  try {
    const list = new URL(text).searchParams.get('list');
    if (list) return list;
  } catch {
    /* not a URL */
  }
  return /^[\w-]{10,}$/.test(text) ? text : '';
}

export const thumbFor = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function parseIsoDuration(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}

async function fromApi(playlistId, key) {
  const tracks = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.search = new URLSearchParams({ part: 'snippet,status', maxResults: '50', playlistId, key, ...(pageToken && { pageToken }) });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API error ${res.status}`);
    const data = await res.json();
    for (const item of data.items || []) {
      const s = item.snippet;
      const id = s?.resourceId?.videoId;
      if (!id || item.status?.privacyStatus === 'private' || s.title === 'Deleted video' || s.title === 'Private video') continue;
      tracks.push({
        id,
        title: s.title,
        channel: (s.videoOwnerChannelTitle || '').replace(/ - Topic$/, ''),
        thumb: s.thumbnails?.medium?.url || thumbFor(id),
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  // Durations need a second call (50 videos at a time).
  for (let i = 0; i < tracks.length; i += 50) {
    const batch = tracks.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.search = new URLSearchParams({ part: 'contentDetails', id: batch.map((t) => t.id).join(','), key });
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const byId = new Map((data.items || []).map((v) => [v.id, parseIsoDuration(v.contentDetails?.duration)]));
    for (const t of batch) t.duration = byId.get(t.id) || 0;
  }
  return tracks;
}

async function fromJson(playlistId) {
  const res = await fetch('playlist.json', { cache: 'no-cache' });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.playlistId !== playlistId || !data.tracks?.length) return null;
  return data.tracks;
}

// Last resort: ask the YouTube player for the playlist's video IDs.
function fromPlayer(playlistId, YT) {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:0';
    const el = document.createElement('div');
    host.append(el);
    document.body.append(host);
    const timeout = setTimeout(() => done(new Error('Timed out reading the playlist')), 15000);
    let probe;
    function done(err, ids) {
      clearTimeout(timeout);
      try {
        probe?.destroy();
      } catch {
        /* ignore */
      }
      host.remove();
      if (err) reject(err);
      else resolve(ids.map((id) => ({ id, title: '', channel: '', thumb: thumbFor(id) })));
    }
    probe = new YT.Player(el, {
      width: 1,
      height: 1,
      playerVars: { listType: 'playlist', list: playlistId, autoplay: 0 },
      events: {
        onReady: () => {
          const poll = setInterval(() => {
            const ids = probe.getPlaylist?.();
            if (ids?.length) {
              clearInterval(poll);
              done(null, ids);
            }
          }, 300);
        },
        onError: (e) => done(new Error(`YouTube could not load the playlist (error ${e.data})`)),
      },
    });
  });
}

// Fill in missing titles with YouTube's public oEmbed endpoint (cached in the browser).
export async function fillTitles(tracks, onUpdate) {
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem('ldr:titles') || '{}');
  } catch {
    /* ignore */
  }
  for (const t of tracks) {
    if (!t.title && cache[t.id]) Object.assign(t, cache[t.id]);
  }
  onUpdate();

  const missing = tracks.filter((t) => !t.title);
  let i = 0;
  const worker = async () => {
    while (i < missing.length) {
      const t = missing[i++];
      try {
        const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${t.id}`)}`);
        if (!res.ok) continue;
        const data = await res.json();
        t.title = data.title;
        t.channel = (data.author_name || '').replace(/ - Topic$/, '');
        cache[t.id] = { title: t.title, channel: t.channel };
        onUpdate();
      } catch {
        /* keep the placeholder title */
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  try {
    localStorage.setItem('ldr:titles', JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export async function loadPlaylist({ playlistId, apiKey, YT }) {
  if (apiKey) {
    try {
      return { tracks: await fromApi(playlistId, apiKey), source: 'api' };
    } catch (err) {
      console.warn('Falling back from the YouTube API:', err);
    }
  }
  try {
    const tracks = await fromJson(playlistId);
    if (tracks) return { tracks, source: 'json' };
  } catch {
    /* no playlist.json */
  }
  return { tracks: await fromPlayer(playlistId, YT), source: 'player' };
}
