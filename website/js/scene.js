// An endless, gently winding country road drawn on a <canvas> (pseudo-3D, segment based).
// Everything is procedural: no images are needed.

const SEGMENT = 200; // world length of one road segment
const RUMBLE = 3; // segments per colour stripe
const ROAD_W = 2000; // half road width in world units
const LANES = 2;
const DRAW_DISTANCE = 260; // segments drawn ahead
const CAMERA_HEIGHT = 1000;
const FOV = 100;
const CAMERA_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const MAX_SPEED = SEGMENT * 60; // one segment per frame at 60fps
const CRUISE = 0.5; // share of MAX_SPEED while music plays
const IDLE = 0.12; // share while paused
const FOG_DENSITY = 4;

export const PALETTES = {
  morning: {
    label: 'Morning',
    sky: ['#8ec5ff', '#ffd9c2'],
    sun: '#fff1c9',
    sunGlow: 'rgba(255, 214, 170, 0.55)',
    sunPos: [0.22, 0.34],
    clouds: 'rgba(255, 255, 255, 0.85)',
    mountains: '#9fb3d9',
    hillsFar: '#8fc7a0',
    hillsNear: '#6db383',
    grass: ['#7cc36a', '#74ba63'],
    road: ['#6d6d74', '#686870'],
    rumble: ['#f4f4f4', '#b9b9bf'],
    lane: '#f6e7a1',
    fog: '#e9e6e6',
    trees: ['#3f8f4f', '#2f7a44', '#5b3a24'],
  },
  day: {
    label: 'Sunny day',
    sky: ['#4aa3ff', '#bfe4ff'],
    sun: '#fffbe3',
    sunGlow: 'rgba(255, 250, 210, 0.5)',
    sunPos: [0.78, 0.16],
    clouds: 'rgba(255, 255, 255, 0.92)',
    mountains: '#8aa6cf',
    hillsFar: '#78c27f',
    hillsNear: '#57ad63',
    grass: ['#6fc25a', '#66b853'],
    road: ['#5f5f66', '#5a5a61'],
    rumble: ['#ffffff', '#c3c3c8'],
    lane: '#ffe27a',
    fog: '#d7ecfb',
    trees: ['#2f8a3e', '#237533', '#5a3a22'],
  },
  golden: {
    label: 'Golden hour',
    sky: ['#5b5ea6', '#ffb36b'],
    sun: '#ffe2a1',
    sunGlow: 'rgba(255, 170, 90, 0.6)',
    sunPos: [0.7, 0.4],
    clouds: 'rgba(255, 214, 190, 0.85)',
    mountains: '#8a6f9e',
    hillsFar: '#8f9a5a',
    hillsNear: '#6f8a47',
    grass: ['#8aa94d', '#819f47'],
    road: ['#5d5561', '#58505c'],
    rumble: ['#fff1de', '#c9b3a6'],
    lane: '#ffd27a',
    fog: '#f3c39a',
    trees: ['#46703a', '#365e2f', '#4a2f1d'],
  },
  night: {
    label: 'Night drive',
    sky: ['#0b1030', '#2b3a6b'],
    sun: '#f4f1ff',
    sunGlow: 'rgba(200, 210, 255, 0.25)',
    sunPos: [0.8, 0.18],
    moon: true,
    stars: true,
    clouds: 'rgba(160, 170, 210, 0.25)',
    mountains: '#1d2448',
    hillsFar: '#1a2d3a',
    hillsNear: '#16283a',
    grass: ['#1d3a2c', '#1a3528'],
    road: ['#2a2a33', '#27272f'],
    rumble: ['#8d8da0', '#4a4a58'],
    lane: '#ffe9a6',
    fog: '#1c2448',
    trees: ['#15301f', '#112819', '#1c140d'],
  },
};

export function timeOfDayFor(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5.5 && h < 9.5) return 'morning';
  if (h >= 9.5 && h < 16.5) return 'day';
  if (h >= 16.5 && h < 19.5) return 'golden';
  return 'night';
}

// Small deterministic RNG so the road is the same on every visit.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

function buildTrack() {
  const rand = rng(7);
  const segments = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  const addSegment = (curve, y) => {
    const n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEGMENT }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEGMENT }, camera: {}, screen: {} },
      curve,
      sprites: [],
      light: Math.floor(n / RUMBLE) % 2 === 0,
    });
  };

  const addRoad = (enter, hold, leave, curve, hill) => {
    const startY = lastY();
    const endY = startY + hill * SEGMENT;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  };

  addRoad(40, 60, 40, 0, 0);
  for (let i = 0; i < 34; i++) {
    const len = 25 + Math.floor(rand() * 50);
    const curve = rand() < 0.25 ? 0 : (rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 3.5);
    const hill = rand() < 0.35 ? 0 : Math.round((rand() - 0.5) * 50);
    // Keep the road from climbing forever.
    const y = lastY() / SEGMENT;
    addRoad(len, len, len, curve, Math.abs(y + hill) > 60 ? -Math.sign(y) * Math.abs(hill) : hill);
  }
  // Return to the starting height so the loop is seamless.
  addRoad(60, 60, 60, 0, -lastY() / SEGMENT);

  // Roadside scenery.
  for (const seg of segments) {
    if (seg.index < 12) continue;
    if (seg.index % 4 === 0 && rand() < 0.7) {
      const side = rand() < 0.5 ? -1 : 1;
      const r = rand();
      seg.sprites.push({
        type: r < 0.45 ? 'tree' : r < 0.8 ? 'pine' : 'bush',
        offset: side * (1.35 + rand() * 2.4),
        size: 0.8 + rand() * 0.6,
      });
    }
    if (seg.index % 3 === 0 && rand() < 0.35) {
      seg.sprites.push({ type: 'flowers', offset: (rand() < 0.5 ? -1 : 1) * (1.15 + rand() * 1.2), size: 1, hue: Math.floor(rand() * 4) });
    }
    if (seg.index % 40 === 0) seg.sprites.push({ type: 'pole', offset: 1.18, size: 1 });
  }
  return segments;
}

// Periodic silhouette (sum of sines) so background layers scroll forever.
function ridge(seed, amps) {
  const rand = rng(seed);
  const waves = amps.map((amp, i) => ({ amp, k: [1, 2, 3, 5, 8, 13][i], phase: rand() * Math.PI * 2 }));
  return (t) => waves.reduce((sum, w) => sum + w.amp * Math.sin(t * Math.PI * 2 * w.k + w.phase), 0);
}

export function createScene(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const segments = buildTrack();
  const trackLength = segments.length * SEGMENT;
  const rand = rng(99);

  const layers = {
    mountains: ridge(1, [0.5, 0.25, 0.15, 0.08, 0.04]),
    hillsFar: ridge(2, [0.35, 0.3, 0.12, 0.06]),
    hillsNear: ridge(3, [0.4, 0.2, 0.15, 0.05]),
  };
  const clouds = Array.from({ length: 9 }, () => ({
    x: rand(),
    y: 0.05 + rand() * 0.28,
    scale: 0.6 + rand() * 0.9,
    speed: 0.004 + rand() * 0.008,
    puffs: Array.from({ length: 5 + Math.floor(rand() * 4) }, (_, i) => ({ dx: i * 0.5 - 1.5 + rand() * 0.3, dy: rand() * 0.5 - 0.35, r: 0.6 + rand() * 0.6 })),
  }));
  const stars = Array.from({ length: 160 }, () => ({ x: rand(), y: rand() * 0.55, r: rand() * 1.3 + 0.2, tw: rand() * Math.PI * 2 }));
  const birds = { x: -0.2, y: 0.2, t: 0, next: 6 };

  let palette = PALETTES.day;
  let w = 0;
  let h = 0;
  let unit = 0;
  let horizon = 0;
  let position = 0;
  let speed = 0;
  let targetShare = IDLE;
  let skyOffset = 0;
  let distance = 0; // km driven, for the odometer
  let clock = 0;
  let last = performance.now();
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.max(w, h * 1.1) / 2;
    horizon = h * 0.52;
    if (reducedMotion) render();
  }

  function project(p, camX, camY, camZ) {
    p.camera.x = -camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const scale = CAMERA_DEPTH / p.camera.z;
    p.screen.scale = scale;
    p.screen.x = w / 2 + scale * p.camera.x * unit;
    p.screen.y = horizon - scale * p.camera.y * unit;
    p.screen.w = scale * ROAD_W * unit;
  }

  function quad(x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.closePath();
    ctx.fill();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, palette.sky[0]);
    g.addColorStop(1, palette.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 2);

    if (palette.stars) {
      for (const s of stars) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 1.5 + s.tw);
        ctx.fillStyle = '#fff';
        ctx.fillRect(((s.x + skyOffset * 0.02) % 1 + 1) % 1 * w, s.y * horizon, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }

    // Sun or moon with a soft glow.
    const [sx, sy] = palette.sunPos;
    const cx = (((sx - skyOffset * 0.03) % 1) + 1) % 1 * w;
    const cy = sy * horizon + horizon * 0.1;
    const r = Math.max(26, unit * 0.06);
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 6);
    glow.addColorStop(0, palette.sunGlow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (palette.moon) {
      ctx.fillStyle = palette.sky[0];
      ctx.beginPath();
      ctx.arc(cx + r * 0.45, cy - r * 0.2, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds drift on their own and slide with the curves.
    ctx.fillStyle = palette.clouds;
    for (const c of clouds) {
      const x = ((((c.x - skyOffset * 0.05) % 1.4) + 1.4) % 1.4) * w - 0.2 * w;
      const y = c.y * horizon;
      const s = unit * 0.06 * c.scale;
      ctx.beginPath();
      for (const p of c.puffs) {
        ctx.moveTo(x + p.dx * s + p.r * s, y + p.dy * s);
        ctx.arc(x + p.dx * s, y + p.dy * s, p.r * s, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // A small flock of birds now and then (not at night).
    if (!palette.stars && birds.t > 0) {
      ctx.strokeStyle = 'rgba(40, 40, 60, 0.7)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const bx = birds.x * w - i * 18 - (i % 2) * 6;
        const by = birds.y * horizon + (i % 2 ? 10 : 0) + i * 4;
        const flap = Math.sin(clock * 9 + i) * 4;
        ctx.beginPath();
        ctx.moveTo(bx - 7, by - flap);
        ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
        ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by - flap);
        ctx.stroke();
      }
    }
  }

  function drawLayer(fn, color, parallax, baseY, height, period) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const offset = skyOffset * parallax;
    for (let x = 0; x <= w + 8; x += 8) {
      const t = (x / (unit * period)) + offset;
      ctx.lineTo(x, baseY - height * (0.55 + 0.45 * fn(t)));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  function drawTree(x, y, s, kind) {
    const [leaf, leafDark, trunk] = palette.trees;
    if (kind === 'pine') {
      ctx.fillStyle = trunk;
      ctx.fillRect(x - s * 0.05, y - s * 0.25, s * 0.1, s * 0.25);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? leaf : leafDark;
        const top = y - s * (0.55 + i * 0.28);
        const half = s * (0.32 - i * 0.07);
        ctx.beginPath();
        ctx.moveTo(x, top - s * 0.3);
        ctx.lineTo(x + half, top + s * 0.18);
        ctx.lineTo(x - half, top + s * 0.18);
        ctx.fill();
      }
    } else if (kind === 'bush') {
      ctx.fillStyle = leafDark;
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.12, s * 0.28, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(x - s * 0.06, y - s * 0.17, s * 0.16, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = trunk;
      ctx.fillRect(x - s * 0.05, y - s * 0.5, s * 0.1, s * 0.5);
      ctx.fillStyle = leafDark;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.72, s * 0.32, 0, Math.PI * 2);
      ctx.arc(x - s * 0.2, y - s * 0.58, s * 0.22, 0, Math.PI * 2);
      ctx.arc(x + s * 0.2, y - s * 0.6, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.arc(x - s * 0.08, y - s * 0.8, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const FLOWER_COLORS = ['#ffd84d', '#ff8fb1', '#ffffff', '#b99bff'];

  function drawSprite(sprite, x, y, scale) {
    const s = scale * unit * 3000 * sprite.size; // sprite height in pixels
    if (s < 1.5) return;
    if (sprite.type === 'flowers') {
      const r = Math.max(0.8, s * 0.012);
      ctx.fillStyle = palette.trees[1];
      ctx.beginPath();
      ctx.ellipse(x, y - r, s * 0.09, r * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = FLOWER_COLORS[sprite.hue];
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const fx = x + (i - 3) * s * 0.025;
        const fy = y - r * (2 + ((i * 5) % 3));
        ctx.moveTo(fx + r, fy);
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (sprite.type === 'pole') {
      ctx.fillStyle = palette.stars ? '#3b3226' : '#7a5a3a';
      ctx.fillRect(x - s * 0.02, y - s * 1.3, s * 0.04, s * 1.3);
      ctx.fillRect(x - s * 0.18, y - s * 1.22, s * 0.36, s * 0.03);
    } else {
      drawTree(x, y, s, sprite.type);
    }
  }

  function render() {
    if (!w || !h) return;
    const base = segments[Math.floor(position / SEGMENT) % segments.length];
    const basePercent = (position % SEGMENT) / SEGMENT;
    const playerY = base.p1.world.y + (base.p2.world.y - base.p1.world.y) * basePercent;
    const camY = playerY + CAMERA_HEIGHT;

    drawSky();
    const lift = Math.max(-40, Math.min(40, playerY / 200));
    drawLayer(layers.mountains, palette.mountains, 0.08, horizon + 4 + lift * 0.2, unit * 0.22, 2.2);
    drawLayer(layers.hillsFar, palette.hillsFar, 0.16, horizon + 6 + lift * 0.5, unit * 0.12, 1.4);
    drawLayer(layers.hillsNear, palette.hillsNear, 0.3, horizon + 10 + lift, unit * 0.07, 1.0);

    // Horizon haze.
    const haze = ctx.createLinearGradient(0, horizon - unit * 0.15, 0, horizon + 20);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, palette.fog);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - unit * 0.15, w, unit * 0.15 + 20);
    ctx.globalAlpha = 1;

    let maxY = h;
    let x = 0;
    let dx = -(base.curve * basePercent);
    const drawn = [];

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = segments[(base.index + n) % segments.length];
      const looped = seg.index < base.index;
      const camZ = position - (looped ? trackLength : 0);
      project(seg.p1, x, camY, camZ);
      project(seg.p2, x + dx, camY, camZ);
      x += dx;
      dx += seg.curve;

      const p1 = seg.p1.screen;
      const p2 = seg.p2.screen;
      seg.clip = maxY;
      seg.fog = 1 / Math.exp((n / DRAW_DISTANCE) ** 2 * FOG_DENSITY);
      drawn.push(seg);
      if (seg.p1.camera.z <= CAMERA_DEPTH || p2.y >= p1.y || p2.y >= maxY) continue;

      const y1 = Math.min(p1.y, maxY);
      const y2 = p2.y - 1; // overlap by a pixel so anti-aliasing never leaves seams
      const i = seg.light ? 0 : 1;
      ctx.fillStyle = palette.grass[i];
      ctx.fillRect(0, y2, w, y1 - y2);

      const r1 = p1.w / 7;
      const r2 = p2.w / 7;
      quad(p1.x, y1, p1.w + r1, p2.x, y2, p2.w + r2, palette.rumble[i]);
      quad(p1.x, y1, p1.w, p2.x, y2, p2.w, palette.road[i]);
      if (seg.light) {
        const l1 = p1.w / 36;
        const l2 = p2.w / 36;
        const lanew1 = (p1.w * 2) / LANES;
        const lanew2 = (p2.w * 2) / LANES;
        for (let lane = 1; lane < LANES; lane++) {
          quad(p1.x - p1.w + lanew1 * lane, y1, l1, p2.x - p2.w + lanew2 * lane, y2, l2, palette.lane);
        }
      }
      if (seg.fog < 1) {
        ctx.globalAlpha = 1 - seg.fog;
        ctx.fillStyle = palette.fog;
        ctx.fillRect(0, y2, w, y1 - y2);
        ctx.globalAlpha = 1;
      }
      maxY = p2.y;
    }

    // Scenery, back to front, clipped behind hill crests.
    for (let n = drawn.length - 1; n > 0; n--) {
      const seg = drawn[n];
      if (!seg.sprites.length || seg.p1.camera.z <= CAMERA_DEPTH) continue;
      const { scale, x: sx, y: sy } = seg.p1.screen;
      if (sy - 2 > seg.clip + unit) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, seg.clip);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, seg.fog * 1.6);
      for (const sprite of seg.sprites) {
        drawSprite(sprite, sx + scale * sprite.offset * ROAD_W * unit, sy, scale);
      }
      ctx.restore();
    }

    if (palette.stars) {
      // Headlight glow on the road.
      const g = ctx.createRadialGradient(w / 2, h * 1.05, 10, w / 2, h * 1.05, h * 0.55);
      g.addColorStop(0, 'rgba(255, 240, 200, 0.28)');
      g.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, w, h - horizon);
    }
  }

  function update(dt) {
    clock += dt;
    const target = MAX_SPEED * targetShare;
    speed += (target - speed) * Math.min(1, dt * 0.8);
    position = (position + speed * dt) % trackLength;
    distance += (speed / MAX_SPEED) * 120 * (dt / 3600); // "km", assuming full speed is 120 km/h
    const seg = segments[Math.floor(position / SEGMENT) % segments.length];
    skyOffset += seg.curve * (speed / MAX_SPEED) * dt * 0.06;

    for (const c of clouds) c.x += c.speed * dt * 0.1;
    birds.next -= dt;
    if (birds.t > 0) {
      birds.t -= dt;
      birds.x += dt * 0.04;
    } else if (birds.next <= 0) {
      birds.t = 30;
      birds.x = -0.1;
      birds.y = 0.12 + Math.random() * 0.25;
      birds.next = 40 + Math.random() * 40;
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  if (reducedMotion) render();
  else raf = requestAnimationFrame(frame);

  return {
    setPalette(name) {
      palette = PALETTES[name] || PALETTES.day;
      if (reducedMotion) render();
    },
    setPlaying(playing) {
      targetShare = playing ? CRUISE : IDLE;
    },
    get speedKmh() {
      return Math.round((speed / MAX_SPEED) * 120);
    },
    get distanceKm() {
      return distance;
    },
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}
