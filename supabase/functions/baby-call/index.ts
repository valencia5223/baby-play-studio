// 📞 baby-call: 전화 놀이에서 친구(아기상어·원숭이·판다)의 대답을 Gemini 로 만든다
//   POST { friend: 'shark'|'monkey'|'panda', turns: [{ who: 'baby'|'friend', text }], phase: 'hello'|'chat'|'bye', audio?, mime? }
//   → { text, heard? }  (짧은 한국어 1~2문장. 목소리는 앱이 baby-voice?who=친구 로 읽는다)
//   audio: 아기가 방금 한 말의 짧은 녹음(base64 WAV). 있으면 Gemini 가 직접 듣고 { heard: 알아들은 말, reply: 대답 } 을 만든다
//   GET ?list=1 → 이 키로 쓸 수 있는 모델 이름 (확인용)
// 키: Supabase Secrets GEMINI_API_KEY (baby-play-studio 전용). 모델: GEMINI_MODEL 없으면 MODELS 를 차례로.
// 녹음·대화는 이 함수에 저장하지 않는다 (Gemini 로 한 번 보내 대답만 받는다).
// 질문을 잘 알아듣는 flash 를 먼저 (lite 는 빠르지만 아기 질문을 자주 놓쳤다), 한도에 걸리면 lite 로
const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
// 생각 시간: 'low'(질문을 제대로 알아듣는다). minimal 은 빠르지만 엉뚱한 대답이 잦았다
const THINKING: (Record<string, unknown> | null)[] = [{ thinkingLevel: 'low' }, { thinkingLevel: 'minimal' }, { thinkingBudget: 256 }, null];
const thinkingChoice = new Map<string, number>();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

// 이 앱에서만 부르게 (다른 사이트가 키를 쓰지 못하도록)
const ALLOWED_ORIGIN = /^https?:\/\/(baby-play-studio\.onrender\.com|localhost(:\d+)?|127\.0\.0\.1(:\d+)?|192\.168\.\d+\.\d+(:\d+)?)$/;

const COMMON = `너는 27개월 아기 "유나"와 장난감 전화로 통화하는 동물 친구야.
규칙:
- 한 번에 1~2문장, 모두 합쳐 35자 안팎. 아주 쉬운 낱말, 의성어와 의태어를 많이 써.
- 유나나 옆의 어른이 물어본 말이 분명하면 먼저 그 말에 바로 대답해. 아기가 알 만한 쉬운 질문(동물, 색깔, 숫자, 음식, 노래)은 쉽게 대답해 줘.
- 돈, 환율, 뉴스, 날씨 숫자 같은 어른 이야기나 지금 일어나는 일은 너는 몰라. 질문을 알아들었다는 걸 보여 주고 "그건 어려운 어른 이야기야, 엄마 아빠한테 물어보자!"처럼 다정하게 말한 뒤 아기 이야기로 이어 가.
- 아기 말은 발음이 서툴러서 알아듣기 어렵거나 비어 있을 수 있어. 정말 못 알아들었을 때만 되묻거나 틀렸다고 하지 말고, 반갑게 맞장구치고 네 이야기나 쉬운 질문으로 이어 가.
- 질문은 "응/아니"나 한 낱말로 답할 수 있게 해. 예: "유나는 사과 좋아해?"
- 늘 다정하고 밝게. 무섭거나 슬프거나 위험한 이야기, 먹으면 안 되는 것, 어른 이야기는 하지 마. 주소·전화번호·어린이집 이름 같은 걸 묻지 마.
- 이모지, 영어, 괄호, 따옴표, 물결표 없이 한글과 . , ! ? 만 써.
- 대답 글자만 써. 이름표나 설명을 붙이지 마.`;

const FRIENDS: Record<string, string> = {
  shark: `너는 "아기상어"야. 바닷속에 엄마상어, 아빠상어, 할머니상어, 할아버지상어와 살아. "뚜루루뚜루" 노래를 정말 좋아하고 명랑해. 흰동가리, 해파리, 꽃게 친구 이야기를 해. 말끝을 "~했어!", "~할래?"처럼 신나게 해.`,
  monkey: `너는 "원숭이"야. 정글 나무 위에 살고 바나나를 제일 좋아해. 장난꾸러기라서 "우끼끼!" 하고 잘 웃어. 나무 타기, 그네 타기, 숨바꼭질 이야기를 해. 빠르고 신나게 말해.`,
  panda: `너는 "판다"야. 대나무 숲에 살고 대나무를 냠냠 먹어. 느긋하고 다정한 형아야. 하품을 자주 하고 낮잠을 좋아해. "음~ 그렇구나" 하고 천천히, 포근하게 말해.`
};

const PHASE: Record<string, string> = {
  hello: '지금 막 전화를 받았어. 유나에게 반갑게 인사하고 너를 소개한 뒤 쉬운 질문 하나를 해.',
  chat: '유나가 한 말에 먼저 대답해. 질문이면 첫 문장에서 꼭 바로 그 질문에 맞는 답을 하고(나이·색깔·좋아하는 것 같은 건 친구로서 귀엽게 지어서 답해도 돼), 배고프다·졸리다 같은 말이면 그 마음에 먼저 공감해. 그다음 짧게 이어서 말해. 이미 인사했으니 다시 인사하지 마.',
  bye: '이제 통화를 끝낼 시간이야. "또 전화해!"처럼 다정하게 작별 인사를 한 문장으로 해.'
};

// 아기에게 들려줄 수 있는 글자만 남기고 길이를 줄인다 (baby-voice 가 받는 글자와 맞춘다)
const clean = (t: string) => {
  let s = (t || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/[~～"'“”‘’()\[\]{}<>*#_]/g, ' ')
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ,.!?\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > 110) { const cut = s.slice(0, 110); const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?')); s = end > 20 ? cut.slice(0, end + 1) : cut; }
  return s;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY 가 등록되지 않았어요' }, 500);

  if (req.method === 'GET') {
    if (new URL(req.url).searchParams.get('list') !== '1') return json({ ok: true });
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey } });
    const d = await r.json();
    return json({ models: (d.models || []).filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m: { name: string }) => m.name.replace('models/', '')) });
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const origin = req.headers.get('origin') || '';
  if (origin && !ALLOWED_ORIGIN.test(origin)) return json({ error: 'forbidden' }, 403);

  let body: { friend?: string; turns?: { who: string; text: string }[]; phase?: string; audio?: string; mime?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const persona = FRIENDS[body.friend || ''];
  if (!persona) return json({ error: 'unknown friend' }, 400);
  const phase = PHASE[body.phase || 'chat'] ? body.phase || 'chat' : 'chat';
  const turns = (body.turns || []).slice(-12).map(t => ({ who: t.who === 'friend' ? 'friend' : 'baby', text: String(t.text || '').slice(0, 200) }));

  // 대화 기록 → Gemini contents (아기 말이 비어 있으면 옹알이로)
  const contents: { role: string; parts: { text: string }[] }[] = [];
  turns.forEach(t => {
    const text = t.who === 'friend' ? t.text : `유나: ${t.text.trim() || '(옹알옹알, 잘 안 들렸어요)'}`;
    const role = t.who === 'friend' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${text}`; else contents.push({ role, parts: [{ text }] });
  });
  // 녹음이 오면: 마지막 아기 차례에 소리를 붙이고, 알아들은 말과 대답을 JSON 으로 받는다
  const audio = typeof body.audio === 'string' && body.audio.length > 100 && body.audio.length < 1_500_000 ? body.audio : null;
  const instruction = audio
    ? `[지금 할 일] 위 녹음은 유나(또는 옆의 어른)가 방금 한 말이야. 들리는 말을 한국어 글자로 heard 에 적고(안 들리거나 옹알이면 빈 글자), 그 말에 맞게 ${PHASE[phase]} 대답은 reply 에 써.`
    : (() => {
      // 아기의 마지막 말을 지시 안에 직접 넣어야 가벼운 모델도 질문을 놓치지 않는다
      const lastBaby = [...turns].reverse().find(t => t.who === 'baby');
      const said = lastBaby && phase === 'chat'
        ? (lastBaby.text.trim() ? `유나가 방금 "${lastBaby.text.trim()}" 라고 말했어. ` : '유나가 아무 말도 안 하고 조용히 듣고 있어. ')
        : '';
      return `[지금 할 일] ${said}${PHASE[phase]}`;
    })();
  const lastIsUser = contents.length && contents[contents.length - 1].role === 'user';
  if (audio) {
    const parts: Record<string, unknown>[] = [{ inlineData: { mimeType: body.mime || 'audio/wav', data: audio } }, { text: instruction }];
    if (lastIsUser) (contents[contents.length - 1].parts as Record<string, unknown>[]).push(...parts);
    else contents.push({ role: 'user', parts: parts as { text: string }[] });
  } else if (!lastIsUser) contents.push({ role: 'user', parts: [{ text: instruction }] });
  else contents[contents.length - 1].parts[0].text += `\n${instruction}`;
  if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(전화 연결)' }] });

  const first = Deno.env.get('GEMINI_MODEL');
  const chain = first ? [first, ...MODELS.filter(m => m !== first)] : MODELS;
  let lastErr = '';
  for (const model of chain) {
    for (let i = thinkingChoice.get(model) ?? 0; i < THINKING.length; i++) {
      const tc = THINKING[i];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${COMMON}\n\n${persona}` }] },
          contents,
          generationConfig: {
            temperature: 0.7, maxOutputTokens: 600, ...(tc ? { thinkingConfig: tc } : {}),
            ...(audio ? { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { heard: { type: 'STRING' }, reply: { type: 'STRING' } }, required: ['heard', 'reply'] } } : {})
          },
          safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
            .map(category => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }))
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 400 && /thinking/i.test(d?.error?.message || '')) continue;   // 이 모델이 받지 않는 생각 설정 → 다음 설정
      if (!r.ok) { lastErr = `${model} ${r.status} ${d?.error?.message || ''}`.slice(0, 200); break; }   // 한도·없는 모델 → 다음 모델
      thinkingChoice.set(model, i);
      const raw = (d?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join(' ');
      let heard = '', reply = raw;
      if (audio) { try { const o = JSON.parse(raw); heard = String(o.heard || ''); reply = String(o.reply || ''); } catch { /* 글자 그대로 */ } }
      const text = clean(reply);
      if (!text) { lastErr = `${model} empty`; break; }
      return json({ text, heard: heard.slice(0, 200), model });
    }
  }
  return json({ error: lastErr || 'no model' }, 502);
});
