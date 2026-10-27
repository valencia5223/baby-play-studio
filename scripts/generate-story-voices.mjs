// 🌙 잠자리 그림책 음성: 부드러운 여성 목소리(ko-KR-SunHiNeural)로 그림책 문장 MP3 를 만든다
// 실행: npm run story-voices  (시스템 Node 18 에서는 실패하므로 포터블 Node 20:
//        ..\node-portable\node-v20.15.0-win-x64\node.exe scripts/generate-story-voices.mjs)
// 결과: public/story-voice/<해시>.mp3 + src/storyVoiceIndex.json (앱은 목록에 있는 문장만 MP3 로 읽고, 없으면 기기 목소리)
// 남성 아나운서 음성(scripts/generate-voices.mjs, public/voice)과는 폴더·목록이 따로다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { collectStoryLines } from '../src/storyData.js';
import { collectBirthdayLines } from '../src/birthdayData.js';   // 🎂 생일 파티 안내도 같은 여성 목소리로
import { voiceKey, formatSpokenKoreanText } from '../src/voiceLines.js';

const VOICE_NAME = 'ko-KR-SunHiNeural';
const PROSODY = { rate: '-6%', pitch: '+3Hz' };   // 잠자리용: 조금 천천히, 살짝 높고 다정하게 (부모가 샘플 비교 후 고름. 너무 늦추면 AI 같은 느낌이 강해진다)
const CONCURRENCY = 2;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'story-voice');
const indexFile = path.join(root, 'src', 'storyVoiceIndex.json');

async function synth(text) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(text, PROSODY);
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

const byKey = new Map();
[...collectStoryLines(), ...collectBirthdayLines()].forEach(l => byKey.set(voiceKey(l), formatSpokenKoreanText(l)));
fs.mkdirSync(outDir, { recursive: true });
const todo = [...byKey].filter(([key]) => !fs.existsSync(path.join(outDir, `${key}.mp3`)));
console.log(`그림책 문장 ${byKey.size}개 / 새로 생성 ${todo.length}개 (${VOICE_NAME})`);

const failed = [];
async function worker() {
  while (todo.length) {
    const [key, text] = todo.shift();
    let buf = null;
    for (let attempt = 0; attempt < 5 && !buf; attempt++) {
      try {
        const b = await synth(text);
        if (b.length > 1000) buf = b;
      } catch {
        await new Promise(r => setTimeout(r, [3000, 8000, 20000, 45000, 0][attempt]));
      }
    }
    if (buf) fs.writeFileSync(path.join(outDir, `${key}.mp3`), buf);
    else failed.push(text);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 더 이상 쓰지 않는 파일 정리
fs.readdirSync(outDir).forEach(f => { if (f.endsWith('.mp3') && !byKey.has(f.slice(0, -4))) fs.unlinkSync(path.join(outDir, f)); });
const available = [...byKey.keys()].filter(k => fs.existsSync(path.join(outDir, `${k}.mp3`))).sort();
fs.writeFileSync(indexFile, JSON.stringify(available) + '\n');
console.log(`완료: MP3 ${available.length}개, 실패 ${failed.length}개`);
failed.forEach(t => console.log(`  ✗ ${t}`));
if (failed.length) process.exitCode = 1;
