// Generates a few short tagged WAV tones so you can try the app without your own music.
// Usage: node scripts/make-sample-music.js [targetDir]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = path.resolve(process.argv[2] || process.env.MUSIC_DIR || path.join(root, 'music'), 'Samples');

const RATE = 22050;

function infoChunk(tags) {
  const parts = Object.entries(tags).map(([id, value]) => {
    let text = Buffer.from(`${value}\0`, 'utf8');
    if (text.length % 2) text = Buffer.concat([text, Buffer.alloc(1)]);
    const head = Buffer.alloc(8);
    head.write(id, 0, 'ascii');
    head.writeUInt32LE(Buffer.byteLength(`${value}\0`), 4);
    return Buffer.concat([head, text]);
  });
  const body = Buffer.concat([Buffer.from('INFO'), ...parts]);
  const head = Buffer.alloc(8);
  head.write('LIST', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

export function makeWav({ seconds, notes, tags }) {
  const samples = Math.floor(seconds * RATE);
  const pcm = Buffer.alloc(samples * 2);
  const noteLen = Math.floor(samples / notes.length);
  for (let i = 0; i < samples; i++) {
    const n = Math.min(notes.length - 1, Math.floor(i / noteLen));
    const t = (i % noteLen) / RATE;
    const env = Math.min(1, t * 40) * Math.exp(-t * 2.2);
    const v = Math.sin(2 * Math.PI * notes[n] * (i / RATE)) * 0.6 + Math.sin(4 * Math.PI * notes[n] * (i / RATE)) * 0.15;
    pcm.writeInt16LE(Math.round(v * env * 0.5 * 32767), i * 2);
  }
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(RATE, 12);
  fmt.writeUInt32LE(RATE * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'ascii');
  dataHead.writeUInt32LE(pcm.length, 4);
  const list = infoChunk(tags);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + fmt.length + list.length + dataHead.length + pcm.length, 4);
  riff.write('WAVE', 8, 'ascii');
  return Buffer.concat([riff, fmt, list, dataHead, pcm]);
}

// A simple diagonal-gradient PNG to use as folder cover art.
export function makePng(size, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const k = (x + y) / (2 * size - 2);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r1 + (r2 - r1) * k;
      raw[o + 1] = g1 + (g2 - g1) * k;
      raw[o + 2] = b1 + (b2 - b1) * k;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hz = (semi) => 261.63 * 2 ** (semi / 12);
const SONGS = [
  ['Tone Garden', 'Morning Scale', [0, 2, 4, 5, 7, 9, 11, 12]],
  ['Tone Garden', 'Evening Arpeggio', [0, 4, 7, 12, 7, 4, 0, 4]],
  ['Tone Garden', 'Minor Thoughts', [0, 3, 7, 10, 7, 3, 0, -2]],
  ['Sine Wave Club', 'Pentatonic Walk', [0, 2, 4, 7, 9, 12, 9, 7]],
  ['Sine Wave Club', 'Fifths', [0, 7, 2, 9, 4, 11, 5, 12]],
  ['Sine Wave Club', 'Slow Descent', [12, 11, 9, 7, 5, 4, 2, 0]],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const trackNo = {};
  for (const [artist, title, semis] of SONGS) {
    const album = artist === 'Tone Garden' ? 'First Light' : 'Club Mix';
    trackNo[album] = (trackNo[album] || 0) + 1;
    const dir = path.join(target, artist, album);
    fs.mkdirSync(dir, { recursive: true });
    const colors = album === 'First Light' ? [[255, 170, 90], [120, 60, 200]] : [[40, 200, 170], [20, 40, 120]];
    fs.writeFileSync(path.join(dir, 'cover.png'), makePng(300, ...colors));
    const file = path.join(dir, `${String(trackNo[album]).padStart(2, '0')} ${title}.wav`);
    fs.writeFileSync(
      file,
      makeWav({
        seconds: 24,
        notes: semis.map(hz),
        tags: { INAM: title, IART: artist, IPRD: album, ITRK: String(trackNo[album]), ICRD: '2026', IGNR: 'Demo' },
      }),
    );
    console.log('wrote', path.relative(root, file));
  }
}
