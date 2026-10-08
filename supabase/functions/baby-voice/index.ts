// 🎙️ baby-voice: 미리 녹음할 수 없는 문장(아이가 직접 지은 물고기 이름 인사 등)을
// 앱의 다른 안내와 같은 남성 아나운서 목소리(ko-KR-InJoonNeural) MP3 로 만들어 준다.
//   GET /functions/v1/baby-voice?text=안녕!%20나는%20게%20뽀뽀예요  →  audio/mpeg
// 앱은 받은 MP3 를 기기에 저장해 두고 다음부터는 서버 없이 재생한다.
import WebSocket from 'npm:ws@8.18.0';
import { synthesize } from './edgeTts.js';

const MAX_LEN = 60;
// 한국어 안내 문장만 받는다 (다른 용도로 쓰이지 않게)
const ALLOWED_TEXT = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ,.!?~'’\-]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors });

  const text = (new URL(req.url).searchParams.get('text') || '').trim();
  if (!text || text.length > MAX_LEN || !ALLOWED_TEXT.test(text)) {
    return new Response('bad text', { status: 400, headers: cors });
  }
  try {
    const mp3 = await synthesize(text, WebSocket);
    return new Response(mp3, {
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }
    });
  } catch (e) {
    return new Response('tts failed: ' + (e as Error).message, { status: 502, headers: cors });
  }
});
