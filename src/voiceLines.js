import { FISH_SPECIES, STAGE_NAMES, breedOf } from './aquariumData.js';
import { FARM_SPECIES, FARM_STAGE_NAMES, farmSpeciesAt, farmBreedOf, FARM_BY_ID, CROPS } from './farmData.js';
import { TRAIN_STATIONS, PASSENGERS, CARGO_COLORS } from './trainData.js';
import { KITCHEN_GUESTS, KITCHEN_MENUS, INGREDIENTS } from './kitchenData.js';
const KOR_COUNT = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두'];

// ═════════════════════════════════════════════════════════════════════════════
// 🎙️ 음성 안내 문장 모음
// 앱에서 말하는 모든 문장은 여기서 만든다. scripts/generate-voices.mjs 가 이 파일로
// 전체 문장 목록을 뽑아 남성 아나운서 음성 MP3(public/voice/<key>.mp3)를 미리 생성한다.
// 문장을 바꾸거나 동물/과일을 추가했으면 `npm run voices` 를 다시 실행할 것.
// (MP3가 없는 문장은 브라우저 기본 TTS로 대신 읽는다)
// ═════════════════════════════════════════════════════════════════════════════

// 한글 조사 자동 연결 헬퍼 (은/는, 이/가, 을/를, 과/와)
export function attachJosa(word, josaType) {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  const hasBatchim = (lastChar - 0xac00) % 28 > 0;
  if (josaType === '은/는') return word + (hasBatchim ? '은' : '는');
  if (josaType === '이/가') return word + (hasBatchim ? '이' : '가');
  if (josaType === '을/를') return word + (hasBatchim ? '을' : '를');
  if (josaType === '과/와') return word + (hasBatchim ? '과' : '와');
  if (josaType === '이에요/예요') return word + (hasBatchim ? '이에요' : '예요');
  if (josaType === '아/야') return word + (hasBatchim ? '아' : '야');
  return word;
}

// 텍스트를 자연스러운 구어체로 다듬고 기호/이모지/물결표 제거
export function formatSpokenKoreanText(text) {
  if (!text) return '';

  // 1. 이모지, 물결표(~), 특수 기호 제거 (TTS가 기호를 소리내어 읽는 현상 방지)
  let cleanText = text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[~～]/g, ' ')
    .replace(/[*#@^&_+={}\[\]<>"'`]/g, ' ')
    .replace(/["'""'']/g, '');

  // 2. 자연스러운 호흡 구분 및 어미 보정
  cleanText = cleanText
    .replace(/배고파요[!.,·…~～\s]*/g, '배고파요, ')
    .replace(/어디 있을까요\?/g, '어디에 있을까요?')
    .replace(/먹고 싶어요[!.]?/g, '먹고 싶대요!')
    .replace(/참 잘했어요[!.]?/g, '참 잘했어요! 대단해요!')
    .replace(/정말 최고예요[!.]?/g, '정말 최고예요!')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanText;
}

// 문장 → MP3 파일 키 (FNV-1a 32bit). 생성 스크립트와 앱이 같은 함수를 쓴다.
export function voiceKey(text) {
  const s = formatSpokenKoreanText(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const FEED_PRAISE_COUNT = 3;

export const VOICE = {
  // 🧩 퍼즐
  puzzleWrong: () => '여기가 아니에요~ 제자리에 쏙 맞춰보세요!',
  puzzleStart: (theme) => `우리 ${attachJosa(theme.name, '을/를')} 퍼즐을 맞춰볼까요?`,
  puzzleDone: (theme) => `와아! 멋진 ${attachJosa(theme.name, '을/를')} 퍼즐을 완성했어요! 참 잘했어요~ 🌟`,

  // 🐠 내 어항 키우기
  aquaWelcome: () => '우리 어항에 온 걸 환영해요! 아기 물고기들을 잘 키워 주세요!',
  aquaWelcomeBack: () => '다시 왔네요! 물고기들이 기다리고 있었어요!',
  aquaHungry: () => '물고기들이 배고프대요! 밥을 주세요!',
  aquaDirty: () => '물이 더러워졌어요! 깨끗하게 청소해 주세요!',
  aquaFeed: () => '맛있는 밥이에요! 냠냠!',
  aquaWaterChange: () => '새 물로 갈아줬어요! 물고기들이 신나요!',
  aquaClean: () => '반짝반짝 깨끗해졌어요!',
  aquaPearl: () => '반짝반짝 조개를 찾았어요!',
  aquaNeedMore: () => '조개가 조금 더 필요해요!',
  aquaGrow: (species, stage) => (species.growLines && species.growLines[stage]) || `와아! ${attachJosa(species.name, '이/가')} ${stage === 'juvenile' ? '어린 물고기로' : '다 큰 물고기로'} 자랐어요!`,
  aquaNewFish: (species) => (species.babyName
    ? `새 친구 ${attachJosa(species.babyName, '이/가')} 왔어요! 잘 키우면 ${attachJosa(species.name, '이/가')} 돼요!`
    : `새 친구 ${attachJosa(species.name, '이/가')} 왔어요! ${species.likedBy ? `${species.likedBy}가 좋아해요!` : '잘 키워 주세요!'}`),
  aquaFishInfo: (species, stage) => ((species.infoLines && species.infoLines[stage]) || `${attachJosa(species.name, '이에요/예요')} 지금은 ${attachJosa((species.stageNames || STAGE_NAMES)[stage], '이에요/예요')}`) + (species.likedBy ? ` ${species.likedBy}가 좋아해요!` : ''),
  aquaShiny: (thing) => `와아! 반짝반짝 특별한 색깔의 ${attachJosa(thing.name, '이/가')} 왔어요!`,
  // 직접 지은 이름은 미리 만든 음성이 없어 기기 음성(TTS)으로 읽는다
  aquaHello: (species, name) => `안녕! 나는 ${species.name} ${attachJosa(name, '이에요/예요')}` + (species.likedBy ? ` ${species.likedBy}가 좋아해요!` : ''),
  aquaRelease: (species) => `안녕, ${attachJosa(species.name, '아/야')}! 넓은 자연에서 행복하게 지내!`,
  aquaNight: () => '밤이 됐어요. 물고기들이 코 자고 있어요.',
  paintFxWiggle: () => '살랑살랑! 그림이 춤을 춰요!',
  paintFxBounce: () => '통통통! 그림이 통통 튀어요! 화면을 누르면 폴짝 뛰어요!',
  paintFxRainbow: () => '반짝반짝! 무지개 그림이 됐어요!',
  paintFxReplay: () => '처음부터 다시 그려 볼게요!',
  paintFxEmpty: () => '먼저 그림을 그려 주세요!',
  aquaTankFresh: () => '민물 어항이에요! 냇물과 연못 친구들이 살아요!',
  aquaTankSea: () => '바다 어항이에요! 바다 친구들이 살아요!',
  aquaSleepTap: () => '쉿, 자고 있어요. 유나도 물고기처럼 자야 할 시간이에요.',
  aquaPregnant: (species, type) => `${species.name} 배 속에 ${type === 'live' ? '아기가' : '알이'} 생겼어요! 배가 점점 불러질 거예요!`,
  aquaBirth: (species) => `와아! ${attachJosa(species.name, '이/가')} 아기를 낳았어요!`,
  aquaEggs: (species) => `${attachJosa(species.name, '이/가')} 알을 낳았어요! 곧 아기가 나와요!`,
  aquaHatch: (species) => (species.babyName ? `알에서 ${attachJosa(species.babyName, '이/가')} 태어났어요!` : `알에서 아기 ${attachJosa(species.name, '이/가')} 태어났어요!`),
  aquaHermitMove: () => '소라게가 더 큰 집으로 이사했어요!',
  aquaDolphinJump: () => '와아! 돌고래가 점프했어요!',
  aquaSick: (species) => `${attachJosa(species.name, '이/가')} 아파요! 밴드를 붙여 주세요!`,
  aquaHeal: (species) => `${attachJosa(species.name, '이/가')} 다 나았어요! 고마워요!`,
  aquaNotSick: () => '이 친구는 안 아파요! 아픈 친구를 찾아 주세요!',
  aquaHealMode: () => '아픈 물고기를 눌러서 밴드를 붙여 주세요!',
  aquaSadFish: (species) => `${attachJosa(species.name, '이/가')} 슬퍼요. 밥을 주고 물을 깨끗하게 해 주세요!`,

  // 🐮 내 목장 (문장 수를 줄이려고 종류 이름이 들어가는 문장은 새 친구·성장·인사뿐)
  farmWelcome: () => '우리 목장에 온 걸 환영해요! 아기 동물들을 잘 돌봐 주세요!',
  farmWelcomeBack: () => '다시 왔네요! 동물 친구들이 기다리고 있었어요!',
  farmHungry: () => '동물 친구들이 배고프대요! 밥을 주세요!',
  farmDirty: () => '동물 친구가 지저분해졌어요! 깨끗하게 씻겨 주세요!',
  farmPoop: () => '바닥에 똥이 있어요! 깨끗하게 치워 주세요!',
  farmFeed: () => '맛있는 밥이에요! 많이 먹어요!',
  farmWash: () => '뽀득뽀득! 깨끗해졌어요!',
  farmWashMode: () => '동물 친구를 문질러서 씻겨 주세요! 똥도 치워 주세요!',
  farmGift: () => '와아! 선물을 받았어요!',
  farmNeedMore: () => '별이 조금 더 필요해요!',
  farmSick: () => '동물 친구가 아파요! 밴드를 붙여 주세요!',
  farmHeal: () => '다 나았어요! 고마워요!',
  farmNotSick: () => '이 친구는 안 아파요! 아픈 친구를 찾아 주세요!',
  farmHealMode: () => '아픈 친구를 눌러서 밴드를 붙여 주세요!',
  farmNight: () => '밤이 됐어요. 동물 친구들이 코 자고 있어요.',
  farmSleepTap: () => '쉿, 자고 있어요. 유나도 코 잘 시간이에요.',
  farmRelease: () => '안녕! 넓은 들판에서 행복하게 지내!',
  farmRain: () => '비가 와요! 동물 친구들이 쉼터로 쏙 들어갔어요!',
  farmSnow: () => '하얀 눈이 펑펑 내려요!',
  farmRainbow: () => '비가 그치고 무지개가 떴어요!',
  farmPlant: (crop) => `${attachJosa(crop.name, '을/를')} 심었어요! 물을 주세요!`,
  farmWater: () => '물을 줬어요! 쑥쑥 자라라!',
  farmThirsty: () => '텃밭이 목말라요! 물을 주세요!',
  farmRipe: () => '텃밭 채소가 다 자랐어요! 눌러서 수확해요!',
  gardenHarvest: (crop) => `와아! ${attachJosa(crop.name, '을/를')} 수확했어요! 바구니에 쏙!`,
  gardenWelcome: () => '텃밭에 온 걸 환영해요! 씨앗을 골라서 밭에 심어 볼까요?',
  gardenRain: () => '비가 와요! 텃밭 채소들이 물을 꿀꺽꿀꺽 마셔요!',
  gardenBug: () => '앗! 애벌레가 채소를 먹으러 왔어요! 눌러서 쫓아 주세요!',
  gardenBugGone: () => '훠이훠이! 애벌레를 쫓아냈어요!',
  gardenEnough: () => '물은 충분해요! 쑥쑥 자라는 중이에요!',
  gardenPickSeed: () => '어떤 씨앗을 심을까요? 골라 주세요!',
  farmBasketFeed: () => '텃밭에서 키운 채소를 줬어요! 맛있게 먹어요!',
  farmBasketEmpty: () => '바구니가 비었어요! 텃밭에서 채소를 키워 와요!',
  farmFavorite: () => '제일 좋아하는 음식이에요! 냠냠 신나요!',
  farmMeat: () => '육식동물 친구들은 고기를 먹어요!',
  farmNew: (species) => (species.babyName
    ? `새 친구 ${attachJosa(species.babyName, '이/가')} 왔어요! 잘 키우면 ${attachJosa(species.name, '이/가')} 돼요!`
    : `새 친구 ${attachJosa(species.name, '이/가')} 왔어요! 잘 돌봐 주세요!`),
  farmGrow: (species, stage) => (stage === 'adult'
    ? `와아! ${attachJosa(species.name, '이/가')} 다 컸어요!`
    : `와아! ${attachJosa(species.babyName || species.name, '이/가')} 쑥쑥 자랐어요!`),
  // 누르면 종류와 자란 단계를 불러 준다 (이름을 지었으면 farmHello)
  farmInfo: (species, stage) => `${attachJosa(species.name, '이에요/예요')} 지금은 ${attachJosa(FARM_STAGE_NAMES[stage], '이에요/예요')}`,
  farmPregnant: (species, type) => `${species.name} 배 속에 ${type === 'egg' ? '알이' : '아기가'} 생겼어요! 배가 점점 불러질 거예요!`,
  farmBirth: (species) => `와아! ${attachJosa(species.name, '이/가')} 아기를 낳았어요!`,
  farmEggs: (species) => `${attachJosa(species.name, '이/가')} 둥지에 알을 낳았어요! 곧 아기가 나와요!`,
  farmHatch: (species) => `알에서 ${attachJosa(species.babyName || `아기 ${species.name}`, '이/가')} 태어났어요!`,
  // 직접 지은 이름은 미리 만든 음성이 없어 원격 음성이나 기기 음성으로 읽는다
  farmHello: (species, name) => `안녕! 나는 ${species.name} ${attachJosa(name, '이에요/예요')}`,

  // 🚂 기차 마을
  trainWelcome: () => '칙칙폭폭 기차 마을에 온 걸 환영해요! 출발 버튼을 눌러 봐요!',
  trainGo: () => '칙칙폭폭! 출발!',
  trainStop: () => '끼익! 멈춰요!',
  trainArrive: (st) => `${st.name}에 도착했어요!`,
  trainBoard: (sp, st) => `${attachJosa(sp.name, '이/가')} 탔어요! ${st.name}에 가고 싶대요!`,
  trainAlight: (sp) => `${attachJosa(sp.name, '이/가')} 내렸어요! 고마워요!`,
  trainCount: (n) => `친구가 ${KOR_COUNT[n] || n} 명 탔어요!`,
  trainFull: () => '자리가 꽉 찼어요! 친구를 먼저 내려 줘요!',
  trainWaitTrain: () => '기차가 역에 오면 태워 줄 수 있어요!',
  trainBox: (c) => `${c.name} 상자예요! 같은 색 칸에 실어 줘요!`,
  trainBoxOk: (c) => `${c.name} 상자는 ${c.name} 칸에 쏙!`,
  trainBoxWrong: () => '어? 색깔이 달라요! 같은 색 칸을 찾아 봐요!',
  trainBoxNoCar: (c) => `${c.name} 화물칸이 없어요! 상점에서 사 볼까요?`,
  trainUnload: () => '짐을 내렸어요! 고마워요!',
  trainRed: () => '빨간불이에요! 신호등을 눌러 볼까요?',
  trainGreen: () => '초록불! 출발해요!',
  trainNewStation: () => '와아! 새 역이 생겼어요! 눈꽃역이에요!',
  trainNeedMore: () => '별이 조금 더 필요해요!',
  trainBuy: () => '와아! 멋지게 바뀌었어요!',

  // 🍳 요리 놀이 (동물 친구 식당, KitchenGame.jsx)
  kitchenArrive: (g) => `딸랑딸랑! ${g.name} 손님이 왔어요! 무엇을 만들어 줄까요?`,
  kitchenMenu: (m) => ({
    sandwich: '샌드위치를 만들어요! 빵 위에 재료를 콕콕 올려 보세요!',
    pizza: '피자를 만들어요! 빨간 소스를 쓱쓱 발라 보세요!',
    skewer: '과일 꼬치를 만들어요! 과일을 콕 눌러서 썰어 보세요!'
  })[m.id],
  kitchenIng: (id) => `${INGREDIENTS[id].name}!`,
  kitchenFav: (g) => `와아! ${INGREDIENTS[g.fav].name}! ${attachJosa(g.name, '이/가')} 제일 좋아하는 거예요!`,
  kitchenFull: () => '와아, 가득 찼어요!',
  kitchenBread: () => '빵을 덮어요. 샌드위치 완성!',
  kitchenTopping: () => '이제 맛있는 재료를 올려 보세요!',
  kitchenBake: () => '오븐에 넣고 구워요. 지글지글!',
  kitchenDing: () => '띵! 피자가 다 구워졌어요!',
  kitchenStick: () => '이제 과일을 꼬치에 끼워 보세요!',
  kitchenServe: () => '다 만들었어요! 손님에게 갖다 주세요!',
  kitchenYum: (g) => `냠냠! 정말 맛있어요! ${attachJosa(g.name, '이/가')} 고맙대요!`,
  kitchenYumFav: (g) => `냠냠! 좋아하는 ${INGREDIENTS[g.fav].name}까지! ${attachJosa(g.name, '이/가')} 엄청 행복하대요!`,

  // 📸 동물 · 탈것 · 바다생물 소리 / 🍎 과일
  itemSound: (item) => `${item.name}! ${item.soundText}`,
  tasty: (item) => `맛있는 ${item.name}!`,

  // ❓ 퀴즈
  quiz: (name, isVehicle) => `${attachJosa(name, '은/는')} ${isVehicle ? '어디 있을까요?' : '누구일까요?'}`,

  // 🦁 동물 과일 먹이기
  feedWish: (animal, food) => `배고파요, ${attachJosa(animal.name, '이/가')} 맛있는 ${attachJosa(food.name, '을/를')} 먹고 싶대요!`,
  feedPraise: (food, idx) => [
    `냠냠! ${food.name} 정말 맛있어요! 고마워요!`,
    `와아! ${food.name} 최고예요! 냠냠 맛있어요!`,
    `냠냠 꿀꺽! 달콤한 ${food.name} 맛있어요! 배가 든든해요!`
  ][idx],
  feedWrongFood: (animal, food) => `으응, 이거 말고! ${attachJosa(animal.name, '은/는')} ${attachJosa(food.name, '을/를')} 먹고 싶대요.`,
  feedWrongAnimal: (animal, food) => `나는 아니에요. ${animal.name}에게 ${attachJosa(food.name, '을/를')} 주세요!`
};

// 앱에서 나올 수 있는 모든 문장 목록 (MP3 생성 스크립트용)
export function collectVoiceLines({ animals, fruits, vehicles, feedAnimals, foods, oceanCreatures, puzzles }) {
  const lines = [VOICE.puzzleWrong(), VOICE.paintFxWiggle(), VOICE.paintFxBounce(), VOICE.paintFxRainbow(), VOICE.paintFxReplay(), VOICE.paintFxEmpty()];
  puzzles.forEach(t => lines.push(VOICE.puzzleStart(t), VOICE.puzzleDone(t)));
  oceanCreatures.forEach(c => lines.push(VOICE.itemSound(c)));
  lines.push(VOICE.aquaWelcome(), VOICE.aquaWelcomeBack(), VOICE.aquaHungry(), VOICE.aquaDirty(), VOICE.aquaFeed(),
    VOICE.aquaWaterChange(), VOICE.aquaClean(), VOICE.aquaPearl(), VOICE.aquaNeedMore(), VOICE.aquaNotSick(), VOICE.aquaHealMode(), VOICE.aquaNight(), VOICE.aquaTankFresh(), VOICE.aquaTankSea(), VOICE.aquaSleepTap(), VOICE.aquaHermitMove(), VOICE.aquaDolphinJump());
  FISH_SPECIES.forEach(sp => {
    lines.push(VOICE.aquaGrow(sp, 'juvenile'), VOICE.aquaGrow(sp, 'adult'), VOICE.aquaNewFish(sp), VOICE.aquaSadFish(sp), VOICE.aquaRelease(sp), VOICE.aquaShiny(sp), VOICE.aquaSick(sp), VOICE.aquaHeal(sp));
    if (sp.babyName) {
      // 다 크기 전에는 어릴 때 이름(올챙이)으로 부른다
      const baby = { ...sp, name: sp.babyName };
      lines.push(VOICE.aquaSadFish(baby), VOICE.aquaRelease(baby), VOICE.aquaShiny(baby), VOICE.aquaSick(baby), VOICE.aquaHeal(baby));
    }
    const bt = breedOf(sp.id).type;
    if (!sp.noBreed) lines.push(VOICE.aquaPregnant(sp, bt), ...(bt === 'live' ? [VOICE.aquaBirth(sp)] : [VOICE.aquaEggs(sp), VOICE.aquaHatch(sp)]));
    Object.keys(STAGE_NAMES).forEach(stage => lines.push(VOICE.aquaFishInfo(sp, stage)));
  });
  lines.push(VOICE.farmWelcome(), VOICE.farmWelcomeBack(), VOICE.farmHungry(), VOICE.farmDirty(), VOICE.farmPoop(), VOICE.farmFeed(), VOICE.farmWash(), VOICE.farmWashMode(),
    VOICE.farmGift(), VOICE.farmNeedMore(), VOICE.farmSick(), VOICE.farmHeal(), VOICE.farmNotSick(), VOICE.farmHealMode(), VOICE.farmNight(), VOICE.farmSleepTap(), VOICE.farmRelease(),
    VOICE.farmRain(), VOICE.farmSnow(), VOICE.farmRainbow(), VOICE.farmWater(), VOICE.farmThirsty(), VOICE.farmRipe(), VOICE.farmFavorite(), VOICE.farmMeat());
  CROPS.forEach(c => lines.push(VOICE.farmPlant(c), VOICE.gardenHarvest(c)));
  lines.push(VOICE.gardenWelcome(), VOICE.gardenRain(), VOICE.gardenBug(), VOICE.gardenBugGone(), VOICE.gardenEnough(), VOICE.gardenPickSeed(), VOICE.farmBasketFeed(), VOICE.farmBasketEmpty());
  FARM_SPECIES.forEach(sp => {
    lines.push(VOICE.farmNew(sp), VOICE.farmGrow(sp, 'young'), VOICE.farmGrow(sp, 'adult'));
    Object.keys(FARM_STAGE_NAMES).forEach(stage => lines.push(VOICE.farmInfo(farmSpeciesAt(sp.id, stage), stage)));
    const bt = farmBreedOf(sp.id).type;
    lines.push(VOICE.farmPregnant(sp, bt), ...(bt === 'egg' ? [VOICE.farmEggs(sp), VOICE.farmHatch(sp)] : [VOICE.farmBirth(sp)]));
  });
  lines.push(VOICE.trainWelcome(), VOICE.trainGo(), VOICE.trainStop(), VOICE.trainFull(), VOICE.trainWaitTrain(), VOICE.trainBoxWrong(), VOICE.trainUnload(),
    VOICE.trainRed(), VOICE.trainGreen(), VOICE.trainNewStation(), VOICE.trainNeedMore(), VOICE.trainBuy());
  TRAIN_STATIONS.forEach(st => {
    lines.push(VOICE.trainArrive(st));
    PASSENGERS.forEach(id => lines.push(VOICE.trainBoard(FARM_BY_ID[id], st)));
  });
  PASSENGERS.forEach(id => lines.push(VOICE.trainAlight(FARM_BY_ID[id])));
  for (let n = 1; n <= 12; n++) lines.push(VOICE.trainCount(n));
  Object.values(CARGO_COLORS).forEach(c => lines.push(VOICE.trainBox(c), VOICE.trainBoxOk(c), VOICE.trainBoxNoCar(c)));
  KITCHEN_GUESTS.forEach(g => lines.push(VOICE.kitchenArrive(g), VOICE.kitchenFav(g), VOICE.kitchenYum(g), VOICE.kitchenYumFav(g)));
  KITCHEN_MENUS.forEach(m => lines.push(VOICE.kitchenMenu(m)));
  Object.keys(INGREDIENTS).forEach(id => lines.push(VOICE.kitchenIng(id)));
  lines.push(VOICE.kitchenFull(), VOICE.kitchenBread(), VOICE.kitchenTopping(), VOICE.kitchenBake(), VOICE.kitchenDing(), VOICE.kitchenStick(), VOICE.kitchenServe());
  [...animals, ...fruits, ...vehicles].forEach(i => lines.push(i.soundText ? VOICE.itemSound(i) : VOICE.tasty(i)));
  fruits.forEach(i => lines.push(VOICE.tasty(i)));
  animals.forEach(i => lines.push(VOICE.quiz(i.name, false)));
  vehicles.forEach(i => lines.push(VOICE.quiz(i.name, true)));
  foods.forEach(f => {
    for (let i = 0; i < FEED_PRAISE_COUNT; i++) lines.push(VOICE.feedPraise(f, i));
    feedAnimals.forEach(a => lines.push(VOICE.feedWish(a, f), VOICE.feedWrongFood(a, f), VOICE.feedWrongAnimal(a, f)));
  });
  return [...new Set(lines)];
}
