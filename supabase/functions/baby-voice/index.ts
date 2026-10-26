// 🎙️ baby-voice: 미리 녹음할 수 없는 문장(아이가 직접 지은 물고기 이름 인사 등)을
// 앱의 다른 안내와 같은 남성 아나운서 목소리(ko-KR-InJoonNeural) MP3 로 만들어 준다.
//   GET /functions/v1/baby-voice?text=안녕!%20나는%20게%20뽀뽀예요  →  audio/mpeg
// 앱은 받은 MP3 를 기기에 저장해 두고 다음부터는 서버 없이 재생한다.
import { synthesize } from './edgeTts.js';
import { RawWebSocket } from './rawWs.ts';

const MAX_LEN = 60;
const FRIEND_MAX_LEN = 120;
// 📞 전화 놀이 친구 목소리 (무료 Edge 목소리 3개를 친구마다 속도·음높이로 다르게). ?who=shark 처럼 부른다
// volume: 휴대폰 스피커에서 앱의 다른 소리보다 작게 들려서 크게 만든다
const FRIEND_VOICES: Record<string, { voice: string; rate: string; pitch: string; volume: string }> = {
  shark: { voice: 'ko-KR-SunHiNeural', rate: '+15%', pitch: '+12Hz', volume: '+60%' },         // 아기상어: 높고 명랑하게
  monkey: { voice: 'ko-KR-HyunsuMultilingualNeural', rate: '+20%', pitch: '+10Hz', volume: '+60%' }, // 원숭이: 빠르고 장난스럽게
  panda: { voice: 'ko-KR-InJoonNeural', rate: '+4%', pitch: '-4Hz', volume: '+60%' }           // 판다: 느긋하고 다정하게 (너무 느리면 답답해서 보통 빠르기)
};
// 한국어 안내 문장만 받는다 (다른 용도로 쓰이지 않게)
const ALLOWED_TEXT = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ,.!?~'’\-]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors });

  const params = new URL(req.url).searchParams;
  const text = (params.get('text') || '').trim();
  const friend = FRIEND_VOICES[params.get('who') || ''];
  if (!text || text.length > (friend ? FRIEND_MAX_LEN : MAX_LEN) || !ALLOWED_TEXT.test(text)) {
    return new Response('bad text', { status: 400, headers: cors });
  }
  try {
    const mp3 = await synthesize(text, RawWebSocket, 15000, friend || {});
    return new Response(mp3, {
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }
    });
  } catch (e) {
    return new Response('tts failed: ' + (e as Error).message, { status: 502, headers: cors });
  }
});
