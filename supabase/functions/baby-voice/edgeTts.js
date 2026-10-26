// Microsoft Edge 온라인 TTS(읽어주기)로 문장 하나를 MP3 로 만든다.
// baby-play-studio 의 미리 만든 음성(scripts/generate-voices.mjs, msedge-tts)과 같은 목소리·속도를 쓴다.
// WebSocket 생성자를 받아서 Supabase(rawWs.ts)와 Node(ws, 로컬 시험) 양쪽에서 같은 코드로 돌 수 있게 했다.

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const GEC_VERSION = '2-143.0.3650.96';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
};

export const VOICE_NAME = 'ko-KR-InJoonNeural';
const RATE = '-4%';

// Sec-MS-GEC v2 (2026-10 서버 변경): "<CS64 체크섬>-<SHA-256>" 을 Edge 저작권 문구 + (시각·토큰)으로 만든다.
// msedge-tts 2.1.1(MIT, github.com/Migushthe2nd/MsEdgeTTS)의 SecMsGec.js 를 옮겨 왔다. 원 분석: github.com/rany2/edge-tts/pull/492
const EDGE_COPYRIGHT = 'Copyright (C) Microsoft Corporation. All rights reserved.';
const SWAP_FIRST_WORD = { swappedWord: 0xEF0569FB, swappedSum: 0x76F50F34, swappedProduct: 0xC3EFEA97 };
const SWAP_SECOND_WORD = { swappedWord: 0xC31713DB, swappedSum: 0x1881CE3C, swappedProduct: 0x35BD1EC9 };
const MIX_FIRST_WORD = [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83];
const MIX_SECOND_WORD = [0xA27416F5, 0xD38396FF, 0x7C932B89, 0xBFA49F69];
const swapHalves = (v) => ((v << 16) | (v >>> 16)) >>> 0;
const toUpperHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
function swapTerm(word, key, m) {
  const sum = Math.imul(word, key) + Math.imul(swapHalves(word), m.swappedWord);
  const product = Math.imul(swapHalves(sum), m.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), m.swappedProduct) + product) >>> 0;
}
function swapAndMultiply(value, multipliers) {
  for (const mul of multipliers) value = Math.imul(swapHalves(value), mul) >>> 0;
  return value;
}
function cs64(message, digest) {
  const dv = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const firstKey = (dv.getUint32(0, true) | 1) >>> 0;
  const secondKey = (dv.getUint32(4, true) | 1) >>> 0;
  const padded = new Uint8Array(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  const words = new DataView(padded.buffer);
  let swapSum = 0, lastSwap = 0, mix = 0, mixSum = 0;
  for (let off = 0; off < padded.length; off += 8) {
    const w1 = words.getUint32(off, true), w2 = words.getUint32(off + 4, true);
    const firstSwap = swapTerm(w1, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(w2, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + firstSwap + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w1, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w2, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }
  const out = new Uint8Array(8);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, lastSwap ^ mix, true);
  ov.setUint32(4, swapSum ^ mixSum, true);
  return out;
}

async function secMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const message = new TextEncoder().encode(`${EDGE_COPYRIGHT}${BigInt(rounded) * 10000000n}${TRUSTED_CLIENT_TOKEN}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', message));
  return `${toUpperHex(cs64(message, digest))}-${toUpperHex(digest)}`;
}

const uuid = () => crypto.randomUUID().replace(/-/g, '');
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function indexOfBytes(hay, needle) {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// opts: { voice, rate, pitch } — 전화 놀이 친구마다 목소리·속도·음높이를 다르게 (없으면 기본 남성 아나운서)
export async function synthesize(text, WebSocketImpl, timeoutMs = 15000, opts = {}) {
  const voice = opts.voice || VOICE_NAME, rate = opts.rate || RATE, pitch = opts.pitch || '+0Hz';
  const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${await secMsGec()}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${uuid()}`;
  const ws = new WebSocketImpl(url, { headers: HEADERS });
  ws.binaryType = 'arraybuffer';
  const audioMark = new TextEncoder().encode('Path:audio\r\n');
  const chunks = [];
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } reject(new Error('timeout')); }, timeoutMs);
    ws.onopen = () => {
      const ts = new Date().toISOString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="ko-KR">` +
        `<voice name="${voice}"><prosody pitch="${pitch}" rate="${rate}" volume="+0%">${xmlEscape(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    };
    ws.onmessage = (m) => {
      if (typeof m.data === 'string') {
        if (m.data.includes('Path:turn.end')) {
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          if (!total) { reject(new Error('no audio')); return; }
          const out = new Uint8Array(total);
          let o = 0;
          chunks.forEach(c => { out.set(c, o); o += c.length; });
          resolve(out);
        }
        return;
      }
      const buf = new Uint8Array(m.data);
      const at = indexOfBytes(buf, audioMark);
      if (at >= 0) chunks.push(buf.slice(at + audioMark.length));
    };
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('ws error: ' + (e?.message || e?.error?.message || 'unknown'))); };
    ws.onclose = () => { clearTimeout(timer); if (!chunks.length) reject(new Error('closed')); };
  });
}
