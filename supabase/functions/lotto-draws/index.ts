// 🎰 lotto-draws: 로또 탭이 열릴 때 동행복권 최신 당첨 결과를 받아 오는 중계
// (브라우저는 CORS 때문에 동행복권을 바로 못 부르고, 이 프로젝트는 서울 리전이라 접속이 잘 됨)
//   GET /functions/v1/lotto-draws?round=1247  →  동행복권 응답 그대로 { data: { list: [...] } }
//   round 근처 10회차(최신 회차까지)를 돌려준다. 아직 없는 회차를 주면 빈 목록.
const BASE = 'https://www.dhlottery.co.kr';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors });

  const round = Number(new URL(req.url).searchParams.get('round'));
  if (!Number.isInteger(round) || round < 1 || round > 99999) {
    return new Response('bad round', { status: 400, headers: cors });
  }
  try {
    const res = await fetch(`${BASE}/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${round}`, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (baby-play-studio)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json?.data?.list)) throw new Error('응답 형식이 바뀌었습니다');
    return new Response(JSON.stringify({ data: { list: json.data.list } }), {
      // 추첨 직후 바로 보이게 캐시는 짧게
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
});
