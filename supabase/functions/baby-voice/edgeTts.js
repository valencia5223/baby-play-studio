// Microsoft Edge 온라인 TTS(읽어주기)로 문장 하나를 MP3 로 만든다.
// baby-play-studio 의 미리 만든 음성(scripts/generate-voices.mjs, msedge-tts)과 같은 목소리·속도를 쓴다.
// WebSocket 생성자를 받아서 Deno(npm:ws)와 Node(ws) 양쪽에서 같은 코드로 돌 수 있게 했다.

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const GEC_VERSION = '1-143.0.3650.96';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
};

export const VOICE_NAME = 'ko-KR-InJoonNeural';
const RATE = '-4%';

async function secMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const data = new TextEncoder().encode(`${BigInt(rounded) * 10000000n}${TRUSTED_CLIENT_TOKEN}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
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

export async function synthesize(text, WebSocketImpl, timeoutMs = 15000) {
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
        `<voice name="${VOICE_NAME}"><prosody pitch="+0Hz" rate="${RATE}" volume="+0%">${xmlEscape(text)}</prosody></voice></speak>`;
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
