// 🌙 잠자리 그림책 이야기 (StoryBook.jsx 가 그리고, scripts/generate-story-voices.mjs 가 여성 목소리 MP3 를 만든다)
// 쪽마다: text(읽는 문장) · bg(배경 종류와 시간) · actors(등장인물) · props(소품)
//   위치 x·y 는 그림 칸 안의 비율(0~1), s 는 그림 칸 짧은 변에 대한 크기 비율
//   actors:  { t: 'fish', sp: 어항 종류 id, g: 성장 0~1, dir: 1 오른쪽 / -1 왼쪽, swim: 살랑살랑 헤엄, sleep }
//            { t: 'animal', sp: 목장 종류 id, g, dir, sleep, lie }
//            { t: 'yuna', pose: stand·stretch·brush·eat·feed·water·bath·kiss·sleep, night: 잠옷 }
//   props:   moon · sun · stars · zzz · hearts · eggs · bubbles · tank · bed · table · sink · tub · can · garden · teddy · jelly · cave · lily · fireflies

export const STORY_SHELF_LINE = '어떤 이야기를 읽어 줄까요?';
export const STORY_END_LINE = '오늘 이야기는 여기까지예요. 잘 자요. 좋은 꿈 꿔요.';
export const STORY_LIMIT_LINE = '오늘 밤 이야기는 다 들었어요. 이제 눈을 감고 코 자요.';

export const STORIES = [
  {
    id: 'shark',
    title: '아기상어의 잘 자요',
    color: '#bfdbfe', ink: '#1e3a8a', cover: { bg: 'sea', time: 'night', fish: 'shark' },
    pages: [
      {
        text: '깊고 푸른 바다에 해님이 꼴깍 넘어가요. 바다가 점점 어두워져요.',
        bg: { kind: 'sea', time: 'dusk' },
        actors: [{ t: 'fish', sp: 'shark', x: 0.5, y: 0.52, s: 0.34, swim: true }, { t: 'fish', sp: 'clownfish', x: 0.2, y: 0.35, s: 0.1, swim: true, dir: -1 }]
      },
      {
        text: '아기상어는 아직 졸리지 않아요. "더 놀래요! 뚜루루뚜루!"',
        bg: { kind: 'sea', time: 'dusk' },
        actors: [{ t: 'fish', sp: 'shark', x: 0.45, y: 0.45, s: 0.36, swim: true, happy: true, loop: true }],
        props: [{ t: 'bubbles', x: 0.7, y: 0.6 }]
      },
      {
        text: '엄마상어가 살며시 다가와요. "아기상어야, 이제 코 잘 시간이야."',
        bg: { kind: 'sea', time: 'dusk' },
        actors: [{ t: 'fish', sp: 'sharkMom', x: 0.32, y: 0.45, s: 0.46, swim: true }, { t: 'fish', sp: 'shark', x: 0.72, y: 0.55, s: 0.3, dir: -1, swim: true }],
        props: [{ t: 'hearts', x: 0.52, y: 0.32 }]
      },
      {
        text: '아빠상어는 바위 동굴 침대를 폭신폭신하게 만들어 줘요.',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'sharkDad', x: 0.36, y: 0.42, s: 0.5, swim: true }],
        props: [{ t: 'cave', x: 0.74, y: 0.78, s: 0.6 }]
      },
      {
        text: '할머니상어는 자장자장 노래를 불러 주고, 할아버지상어는 해초 이불을 덮어 줘요.',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'sharkGrandma', x: 0.28, y: 0.38, s: 0.42, swim: true }, { t: 'fish', sp: 'sharkGrandpa', x: 0.72, y: 0.5, s: 0.44, dir: -1, swim: true }],
        props: [{ t: 'notes', x: 0.3, y: 0.18 }]
      },
      {
        text: '흰동가리도, 해마도, 꽃게도 하품을 해요. 하아암.',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'clownfish', x: 0.22, y: 0.4, s: 0.16, swim: true }, { t: 'fish', sp: 'seahorse', x: 0.5, y: 0.42, s: 0.16, swim: true }, { t: 'fish', sp: 'crab', x: 0.76, y: 0.8, s: 0.2 }],
        props: [{ t: 'zzz', x: 0.25, y: 0.28 }, { t: 'zzz', x: 0.53, y: 0.24 }, { t: 'zzz', x: 0.8, y: 0.6 }]
      },
      {
        text: '아기상어가 작은 목소리로 말해요. "엄마, 아빠, 사랑해요."',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'sharkMom', x: 0.25, y: 0.4, s: 0.38 }, { t: 'fish', sp: 'shark', x: 0.52, y: 0.55, s: 0.26 }, { t: 'fish', sp: 'sharkDad', x: 0.78, y: 0.42, s: 0.4, dir: -1 }],
        props: [{ t: 'hearts', x: 0.52, y: 0.3 }]
      },
      {
        text: '해파리들이 반짝반짝 밤바다를 비춰 줘요.',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'jellyfish', x: 0.25, y: 0.35, s: 0.18, swim: true }, { t: 'fish', sp: 'jellyfish', x: 0.55, y: 0.25, s: 0.14, swim: true }, { t: 'fish', sp: 'jellyfish', x: 0.78, y: 0.42, s: 0.2, swim: true }],
        props: [{ t: 'jelly' }]
      },
      {
        text: '아기상어도 눈을 꼭 감아요. 잘 자, 아기상어. 좋은 꿈 꿔.',
        bg: { kind: 'sea', time: 'night' },
        actors: [{ t: 'fish', sp: 'shark', x: 0.58, y: 0.66, s: 0.32, sleep: true }],
        props: [{ t: 'cave', x: 0.6, y: 0.86, s: 0.7 }, { t: 'zzz', x: 0.72, y: 0.5 }]
      }
    ]
  },
  {
    id: 'farm',
    title: '목장 친구들 코 자요',
    color: '#fed7aa', ink: '#7c2d12', cover: { bg: 'farm', time: 'sunset', animal: 'cow' },
    pages: [
      {
        text: '노을이 빨갛게 물든 목장이에요. 하루 종일 신나게 놀았어요.',
        bg: { kind: 'farm', time: 'sunset' },
        actors: [{ t: 'animal', sp: 'cow', x: 0.3, y: 0.86, s: 0.34 }, { t: 'animal', sp: 'sheep', x: 0.62, y: 0.88, s: 0.28, dir: -1 }, { t: 'animal', sp: 'chicken', x: 0.85, y: 0.9, s: 0.16, dir: -1 }]
      },
      {
        text: '꼬끼오! 엄마 닭은 병아리들을 날개 밑에 쏙 품어요.',
        bg: { kind: 'farm', time: 'sunset' },
        actors: [{ t: 'animal', sp: 'chicken', x: 0.48, y: 0.86, s: 0.32, lie: 0.6 }, { t: 'animal', sp: 'chicken', g: 0.08, x: 0.3, y: 0.88, s: 0.16 }, { t: 'animal', sp: 'chicken', g: 0.08, x: 0.68, y: 0.9, s: 0.15, dir: -1 }]
      },
      {
        text: '음메에. 젖소는 푹신한 풀밭에 털썩 누워요.',
        bg: { kind: 'farm', time: 'sunset' },
        actors: [{ t: 'animal', sp: 'cow', x: 0.5, y: 0.88, s: 0.46, lie: 1 }]
      },
      {
        text: '매애애. 양은 복슬복슬 털 이불을 덮은 것 같아요. 참 따뜻해요.',
        bg: { kind: 'farm', time: 'dusk' },
        actors: [{ t: 'animal', sp: 'sheep', x: 0.38, y: 0.88, s: 0.38, lie: 1 }, { t: 'animal', sp: 'sheep', g: 0.15, x: 0.66, y: 0.9, s: 0.26, lie: 1, dir: -1 }]
      },
      {
        text: '꿀꿀! 아기 돼지는 엄마 돼지 옆에 꼭 붙어요.',
        bg: { kind: 'farm', time: 'dusk' },
        actors: [{ t: 'animal', sp: 'pig', x: 0.42, y: 0.88, s: 0.4, lie: 1 }, { t: 'animal', sp: 'pig', g: 0.15, x: 0.68, y: 0.9, s: 0.24, lie: 1, dir: -1 }],
        props: [{ t: 'hearts', x: 0.55, y: 0.5 }]
      },
      {
        text: '멍멍! 강아지는 헛간 앞을 지키다가 꾸벅꾸벅 졸아요.',
        bg: { kind: 'farm', time: 'night' },
        actors: [{ t: 'animal', sp: 'dog', x: 0.56, y: 0.88, s: 0.32, lie: 1 }],
        props: [{ t: 'zzz', x: 0.66, y: 0.6 }]
      },
      {
        text: '하늘에 동그란 달님이 떴어요. 달님이 말해요. "모두 잘 자렴."',
        bg: { kind: 'farm', time: 'night' },
        actors: [{ t: 'animal', sp: 'horse', x: 0.3, y: 0.88, s: 0.36, lie: 1 }, { t: 'animal', sp: 'rabbit', x: 0.7, y: 0.9, s: 0.18, lie: 1, dir: -1 }],
        props: [{ t: 'moon', x: 0.74, y: 0.2, s: 0.16, face: true }]
      },
      {
        text: '쉿! 목장 친구들이 모두 코 자요. 쿨쿨, 새근새근.',
        bg: { kind: 'farm', time: 'night' },
        actors: [
          { t: 'animal', sp: 'cow', x: 0.2, y: 0.88, s: 0.3, sleep: true }, { t: 'animal', sp: 'sheep', x: 0.42, y: 0.9, s: 0.24, sleep: true },
          { t: 'animal', sp: 'pig', x: 0.62, y: 0.9, s: 0.24, sleep: true, dir: -1 }, { t: 'animal', sp: 'dog', x: 0.82, y: 0.9, s: 0.2, sleep: true, dir: -1 }
        ],
        props: [{ t: 'moon', x: 0.8, y: 0.18, s: 0.12, face: true }, { t: 'zzz', x: 0.3, y: 0.55 }, { t: 'zzz', x: 0.7, y: 0.6 }]
      }
    ]
  },
  {
    id: 'frog',
    title: '올챙이가 개구리가 됐어요',
    color: '#bbf7d0', ink: '#14532d', cover: { bg: 'pond', time: 'day', fish: 'frog' },
    pages: [
      {
        text: '연못 속 수초에 동글동글 투명한 알이 붙어 있어요.',
        bg: { kind: 'pond', time: 'day' },
        props: [{ t: 'eggs', x: 0.5, y: 0.6, s: 0.28 }]
      },
      {
        text: '톡! 알에서 꼬물꼬물 올챙이가 나왔어요. 안녕, 올챙이야!',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'frog', g: 0.04, x: 0.42, y: 0.5, s: 0.22, swim: true }, { t: 'fish', sp: 'frog', g: 0.03, x: 0.66, y: 0.62, s: 0.18, swim: true, dir: -1 }],
        props: [{ t: 'eggs', x: 0.2, y: 0.74, s: 0.18, hatched: true }]
      },
      {
        text: '올챙이는 꼬리를 살랑살랑 흔들며 헤엄쳐요. 냠냠, 밥도 잘 먹어요.',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'frog', g: 0.18, x: 0.45, y: 0.5, s: 0.3, swim: true, loop: true }],
        props: [{ t: 'flakes', x: 0.6, y: 0.3 }]
      },
      {
        text: '어느 날, 뒷다리가 쏙! 나왔어요.',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'frog', g: 0.45, x: 0.5, y: 0.5, s: 0.36, swim: true }]
      },
      {
        text: '앞다리도 쏙! 꼬리는 점점 짧아져요.',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'frog', g: 0.7, x: 0.5, y: 0.5, s: 0.38, swim: true }]
      },
      {
        text: '짜잔! 올챙이가 개구리가 됐어요. 개굴개굴!',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'frog', g: 1, x: 0.5, y: 0.45, s: 0.4, happy: true }],
        props: [{ t: 'sparkle', x: 0.5, y: 0.4 }]
      },
      {
        text: '옆 연못의 아기 도롱뇽도 깃털 아가미를 살랑살랑, 무럭무럭 자라요.',
        bg: { kind: 'pond', time: 'day' },
        actors: [{ t: 'fish', sp: 'salamander', g: 0.15, x: 0.42, y: 0.62, s: 0.34, swim: true }, { t: 'fish', sp: 'frog', g: 1, x: 0.78, y: 0.36, s: 0.2, dir: -1 }]
      },
      {
        text: '잘 먹고 잘 자면 우리도 쑥쑥 자라요. 오늘 밤도 푹 자요. 개굴개굴.',
        bg: { kind: 'pond', time: 'night' },
        actors: [{ t: 'fish', sp: 'frog', g: 1, x: 0.5, y: 0.6, s: 0.32, sleep: true }],
        props: [{ t: 'fireflies' }, { t: 'zzz', x: 0.62, y: 0.42 }]
      }
    ]
  },
  {
    id: 'yuna',
    title: '유나의 하루',
    color: '#fbcfe8', ink: '#831843', cover: { bg: 'room', time: 'morning', yuna: 'stretch' },
    pages: [
      {
        text: '아침 해님이 방긋! 유나가 기지개를 쭉 켜요. "잘 잤다!"',
        bg: { kind: 'room', time: 'morning' },
        actors: [{ t: 'yuna', pose: 'stretch', x: 0.42, y: 0.9, s: 0.62, night: true }],
        props: [{ t: 'bed', x: 0.8, y: 0.9, s: 0.5 }, { t: 'teddy', x: 0.8, y: 0.66, s: 0.12 }]
      },
      {
        text: '치카치카, 이를 닦아요. 하얀 이가 반짝반짝!',
        bg: { kind: 'bathroom', time: 'morning' },
        actors: [{ t: 'yuna', pose: 'brush', x: 0.42, y: 0.92, s: 0.62 }],
        props: [{ t: 'sink', x: 0.68, y: 0.92, s: 0.5 }, { t: 'bubbles', x: 0.52, y: 0.42, small: true }]
      },
      {
        text: '냠냠, 밥을 꼭꼭 씹어 먹어요. 쑥쑥 크려면 골고루 먹어요.',
        bg: { kind: 'kitchen', time: 'morning' },
        actors: [{ t: 'yuna', pose: 'eat', x: 0.45, y: 0.92, s: 0.6 }],
        props: [{ t: 'table', x: 0.5, y: 0.92, s: 0.7 }]
      },
      {
        text: '어항 친구들에게 밥을 줘요. "물고기야, 맛있게 먹어!"',
        bg: { kind: 'room', time: 'morning' },
        actors: [{ t: 'yuna', pose: 'feed', x: 0.3, y: 0.92, s: 0.6 }],
        props: [{ t: 'tank', x: 0.68, y: 0.62, s: 0.42 }]
      },
      {
        text: '텃밭에 물을 주고, 목장 친구들도 살살 쓰다듬어 줘요.',
        bg: { kind: 'yard', time: 'day' },
        actors: [{ t: 'yuna', pose: 'water', x: 0.3, y: 0.9, s: 0.56 }, { t: 'animal', sp: 'rabbit', x: 0.78, y: 0.9, s: 0.2, dir: -1 }],
        props: [{ t: 'garden', x: 0.55, y: 0.92, s: 0.3 }]
      },
      {
        text: '보글보글 목욕을 해요. 비누 거품이 몽글몽글!',
        bg: { kind: 'bathroom', time: 'evening' },
        actors: [{ t: 'yuna', pose: 'bath', x: 0.5, y: 0.98, s: 0.56 }],
        props: [{ t: 'tub', x: 0.5, y: 0.92, s: 0.7 }, { t: 'bubbles', x: 0.5, y: 0.5 }]
      },
      {
        text: '잠옷을 입고, 엄마 아빠에게 뽀뽀! "엄마, 아빠, 잘 자요."',
        bg: { kind: 'room', time: 'night' },
        actors: [{ t: 'yuna', pose: 'kiss', x: 0.45, y: 0.92, s: 0.62, night: true }],
        props: [{ t: 'hearts', x: 0.62, y: 0.32 }, { t: 'bed', x: 0.82, y: 0.92, s: 0.46 }]
      },
      {
        text: '별님 달님이 창문으로 인사해요. 유나야, 오늘도 정말 잘했어. 잘 자.',
        bg: { kind: 'room', time: 'night' },
        actors: [{ t: 'yuna', pose: 'sleep', x: 0.55, y: 0.86, s: 0.7, night: true }],
        props: [{ t: 'teddy', x: 0.28, y: 0.72, s: 0.12 }, { t: 'zzz', x: 0.5, y: 0.45 }]
      }
    ]
  }
];

// 그림책에서 나오는 모든 문장 (여성 목소리 MP3 생성용)
export function collectStoryLines() {
  const lines = [STORY_SHELF_LINE, STORY_END_LINE, STORY_LIMIT_LINE];
  STORIES.forEach(s => { lines.push(s.title); s.pages.forEach(p => lines.push(p.text)); });
  return lines;
}
