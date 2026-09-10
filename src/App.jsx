import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Volume2, VolumeX, RotateCcw, Smartphone, X, Play, Pause, SkipForward, SkipBack, Music, Eraser } from 'lucide-react';
import duckImg from './assets/duck.jpg';
import strawberryImg from './assets/strawberry.jpg';
import tangerineImg from './assets/tangerine.jpg';
import peachImg from './assets/peach.jpg';
import melonImg from './assets/melon.jpg';
import pineappleImg from './assets/pineapple.jpg';
import broccoliImg from './assets/broccoli.jpg';
import sweetPotatoImg from './assets/sweet_potato.jpg';

// --- 실제 동물 울음소리 MP3 재생 사운드 엔진 ---
class BabySoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.currentAudio = null;
    this.audioCache = new Map();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 앱 진입 시 모든 동물 울음소리를 백그라운드에서 사전 프리로드 및 메모리 캐싱 (딜레이 0초 달성)
  preloadItemSounds(items) {
    items.forEach(item => {
      const url = item.soundUrl || `/sounds/${item.id}.mp3`;
      if (url && !this.audioCache.has(url)) {
        try {
          const audio = new Audio(url);
          audio.preload = 'auto';
          audio.load();
          this.audioCache.set(url, audio);
        } catch (e) { }
      }
    });
  }

  // 실제 동물 녹음 MP3 파일 재생 (지연 없는 0초 반응)
  playItemSound(item) {
    if (this.muted) return;
    this.init();

    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      const id = item.id;
      const idCap = id.charAt(0).toUpperCase() + id.slice(1);
      const idUpper = id.toUpperCase();

      // soundUrl이 있으면 최우선(1순위)으로 직접 재생하여 불필요한 404 network delay 완전 방지
      const candidates = item.soundUrl
        ? [item.soundUrl, `/sounds/${id}.mp3`, `/sounds/${idCap}.mp3`, `/sounds/${idUpper}.mp3`]
        : [`/sounds/${id}.mp3`, `/sounds/${idCap}.mp3`, `/sounds/${idUpper}.mp3`, `/songs/${id}.mp3`].filter(Boolean);

      const tryNext = (index) => {
        if (index >= candidates.length) return;
        const src = candidates[index];
        let audio;

        if (this.audioCache.has(src)) {
          audio = this.audioCache.get(src).cloneNode(true);
        } else {
          audio = new Audio(src);
        }

        audio.volume = 0.85;
        audio.currentTime = 0;
        audio.play().then(() => {
          this.currentAudio = audio;
        }).catch(() => {
          tryNext(index + 1);
        });
      };
      tryNext(0);
    } catch (e) { }
  }

  stopAllSounds() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) { }
      this.currentAudio = null;
    }
  }

  playFreq(freq, type = 'sine', duration = 0.25, gainVal = 0.4) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) { }
  }

  playXylophone(freq = 523.25) {
    this.playFreq(freq, 'triangle', 0.45, 0.6);
  }

  playPopSound() {
    this.playFreq(800, 'sine', 0.08, 0.5);
    setTimeout(() => this.playFreq(1200, 'sine', 0.06, 0.4), 40);
  }

  playFanfare() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playXylophone(freq), idx * 110);
    });
    try {
      confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
    } catch (e) { }
  }



  playYum() {
    this.playFreq(587.33, 'triangle', 0.2, 0.5);
    setTimeout(() => this.playFreq(880, 'triangle', 0.2, 0.5), 120);
  }
}

const audioEngine = new BabySoundEngine();

// =============================================================================
// 20종 동물 – Pexels 실사 사진 + Mixkit 실제 동물 울음소리 MP3
// Pexels: 파일명에 동물명이 포함된 공인 사진  |  Mixkit: 브라우저 네트워크로 직접 검증한 실제 녹음 MP3
// =============================================================================
const REAL_ANIMALS = [
  {
    id: 'dog', name: '강아지', soundText: '멍멍! 왈왈!', icon: '🐶',
    img: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1/1-preview.mp3',
    color: '#f97316', bg: '#ffedd5', fitPos: 'center 30%'
  },

  {
    id: 'cat', name: '고양이', soundText: '야옹~ 야옹~', icon: '🐱',
    img: 'https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/93/93-preview.mp3',
    color: '#ec4899', bg: '#fce7f3', fitPos: 'center 20%'
  },

  {
    id: 'lion', name: '사자', soundText: '어흥! 어흥!', icon: '🦁',
    img: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/6/6-preview.mp3',
    color: '#d97706', bg: '#fef3c7', fitPos: 'center 30%'
  },

  {
    id: 'cow', name: '소', soundText: '음머어~!', icon: '🐮',
    img: 'https://images.pexels.com/photos/422218/pexels-photo-422218.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1751/1751-preview.mp3',
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center 30%'
  },

  {
    id: 'duck', name: '오리', soundText: '꽥꽥! 꽥꽥!', icon: '🦆',
    img: duckImg,
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/20/20-preview.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 30%'
  },

  {
    id: 'monkey', name: '원숭이', soundText: '우끼끼! 우끼끼!', icon: '🐵',
    img: 'https://images.pexels.com/photos/1207875/pexels-photo-1207875.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/monkey.mp3',
    color: '#854d0e', bg: '#fef3c7', fitPos: 'center 20%'
  },

  {
    id: 'horse', name: '말', soundText: '히힝~! 다닥다닥!', icon: '🐴',
    img: 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/76/76-preview.mp3',
    color: '#78350f', bg: '#fef3c7', fitPos: 'center 25%'
  },

  {
    id: 'chicken', name: '닭', soundText: '꼬꼬댁! 꼭끼오!', icon: '🐔',
    img: 'https://images.pexels.com/photos/1769279/pexels-photo-1769279.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3',
    color: '#dc2626', bg: '#fee2e2', fitPos: 'center 20%'
  },

  {
    id: 'panda', name: '판다', soundText: '우물우물~ 판다!', icon: '🐼',
    img: 'https://images.pexels.com/photos/3608263/pexels-photo-3608263.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/panda.mp3',
    color: '#0f172a', bg: '#f1f5f9', fitPos: 'center 20%'
  },

  {
    id: 'elephant', name: '코끼리', soundText: '뿌우우~!', icon: '🐘',
    img: 'https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/elephant.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 30%'
  },

  {
    id: 'tiger', name: '호랑이', soundText: '크아앙! 어흥!', icon: '🐯',
    img: 'https://images.pexels.com/photos/792381/pexels-photo-792381.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/tiger.mp3',
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },

  {
    id: 'pig', name: '돼지', soundText: '꿀꿀! 꿀꿀!', icon: '🐷',
    img: 'https://images.pexels.com/photos/1300361/pexels-photo-1300361.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/3/3-preview.mp3',
    color: '#f43f5e', bg: '#ffe4e6', fitPos: 'center 20%'
  },

  {
    id: 'rabbit', name: '토끼', soundText: '깡충 깡충!', icon: '🐰',
    img: 'https://images.pexels.com/photos/326012/pexels-photo-326012.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/rabbit.mp3',
    color: '#a855f7', bg: '#f3e8ff', fitPos: 'center 20%'
  },

  {
    id: 'sheep', name: '양', soundText: '음메~ 음메~', icon: '🐑',
    img: 'https://images.pexels.com/photos/288621/pexels-photo-288621.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/sheep.mp3',
    color: '#64748b', bg: '#f8fafc', fitPos: 'center 30%'
  },

  {
    id: 'frog', name: '개구리', soundText: '개굴개굴! 펄쩍!', icon: '🐸',
    img: 'https://images.pexels.com/photos/70083/frog-macro-amphibian-green-70083.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1241/1241-preview.mp3',
    color: '#15803d', bg: '#dcfce7', fitPos: 'center 20%'
  },

  {
    id: 'penguin', name: '펭귄', soundText: '뒤뚱뒤뚱~!', icon: '🐧',
    img: 'https://images.pexels.com/photos/86405/penguin-funny-blue-water-86405.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/penguin.mp3',
    color: '#0f172a', bg: '#f1f5f9', fitPos: 'center 20%'
  },

  {
    id: 'fox', name: '여우', soundText: '컹컹! 여우!', icon: '🦊',
    img: 'https://images.pexels.com/photos/247399/pexels-photo-247399.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/fox.mp3',
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },

  {
    id: 'bear', name: '곰', soundText: '크엉~ 곰!', icon: '🐻',
    img: 'https://images.pexels.com/photos/158109/kodiak-brown-bear-adult-portrait-wildlife-158109.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/bear.mp3',
    color: '#78350f', bg: '#fef3c7', fitPos: 'center 20%'
  },

  {
    id: 'owl', name: '부엉이', soundText: '부엉부엉~', icon: '🦉',
    img: 'https://images.pexels.com/photos/1904354/pexels-photo-1904354.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/owl.mp3',
    color: '#581c87', bg: '#f3e8ff', fitPos: 'center 30%'
  },

  {
    id: 'dolphin', name: '돌고래', soundText: '끼익끼익! 첨벙!', icon: '🐬',
    img: 'https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/dolphin.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 20%'
  }
];

// =============================================================================
// 🍎 싱싱 과일 & 채소 데이터셋 (실사 이미지 관찰 + 곰돌이 먹이기 공통 사용)
// =============================================================================
const REAL_FRUITS = [
  // ── 과일 ──
  {
    id: 'apple', name: '사과', icon: '🍎', category: '과일',
    img: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#ef4444', bg: '#fee2e2', fitPos: 'center 30%'
  },
  {
    id: 'banana', name: '바나나', icon: '🍌', category: '과일',
    img: 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#d97706', bg: '#fef3c7', fitPos: 'center 30%'
  },
  {
    id: 'grape', name: '포도', icon: '🍇', category: '과일',
    img: 'https://images.pexels.com/photos/708777/pexels-photo-708777.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#7e22ce', bg: '#f3e8ff', fitPos: 'center 20%'
  },
  {
    id: 'watermelon', name: '수박', icon: '🍉', category: '과일',
    img: 'https://images.pexels.com/photos/1313267/pexels-photo-1313267.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#15803d', bg: '#dcfce7', fitPos: 'center 30%'
  },
  {
    id: 'strawberry', name: '딸기', icon: '🍓', category: '과일',
    img: strawberryImg,
    color: '#e11d48', bg: '#ffe4e6', fitPos: 'center 20%'
  },
  {
    id: 'tangerine', name: '귤', icon: '🍊', category: '과일',
    img: tangerineImg,
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },
  {
    id: 'peach', name: '복숭아', icon: '🍑', category: '과일',
    img: peachImg,
    color: '#f43f5e', bg: '#ffe4e6', fitPos: 'center center'
  },
  {
    id: 'pineapple', name: '파인애플', icon: '🍍', category: '과일',
    img: pineappleImg,
    color: '#b45309', bg: '#fef3c7', fitPos: 'center center', objectFit: 'contain'
  },
  {
    id: 'melon', name: '멜론', icon: '🍈', category: '과일',
    img: melonImg,
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'cherry', name: '체리', icon: '🍒', category: '과일',
    img: 'https://images.pexels.com/photos/109274/pexels-photo-109274.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#be123c', bg: '#ffe4e6', fitPos: 'center 20%'
  },
  {
    id: 'blueberry', name: '블루베리', icon: '🫐', category: '과일',
    img: 'https://images.pexels.com/photos/1395958/pexels-photo-1395958.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#4338ca', bg: '#e0e7ff', fitPos: 'center 30%'
  },
  // ── 채소 ──
  {
    id: 'carrot', name: '당근', icon: '🥕', category: '채소',
    img: 'https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#f97316', bg: '#ffedd5', fitPos: 'center 30%'
  },
  {
    id: 'broccoli', name: '브로콜리', icon: '🥦', category: '채소',
    img: broccoliImg,
    color: '#15803d', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'corn', name: '옥수수', icon: '🌽', category: '채소',
    img: 'https://images.pexels.com/photos/547263/pexels-photo-547263.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#ca8a04', bg: '#fef9c3', fitPos: 'center 30%'
  },
  {
    id: 'sweet_potato', name: '고구마', icon: '🍠', category: '채소',
    img: sweetPotatoImg,
    color: '#9333ea', bg: '#f3e8ff', fitPos: 'center center'
  },
  {
    id: 'potato', name: '감자', icon: '🥔', category: '채소',
    img: 'https://images.pexels.com/photos/144248/potatoes-vegetables-erdfrucht-bio-144248.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#a16207', bg: '#fef3c7', fitPos: 'center 30%'
  },
  {
    id: 'tomato', name: '토마토', icon: '🍅', category: '채소',
    img: 'https://images.pexels.com/photos/1327838/pexels-photo-1327838.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#dc2626', bg: '#fee2e2', fitPos: 'center 30%'
  },
  {
    id: 'cucumber', name: '오이', icon: '🥒', category: '채소',
    img: 'https://images.pexels.com/photos/2329440/pexels-photo-2329440.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center 30%'
  },
  {
    id: 'eggplant', name: '가지', icon: '🍆', category: '채소',
    img: 'https://images.pexels.com/photos/321551/pexels-photo-321551.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#7e22ce', bg: '#f3e8ff', fitPos: 'center 30%'
  }
];

// 배열 무작위 셔플 헬퍼
const shuffleArray = (arr) => [...arr].sort(() => 0.5 - Math.random());

// 곰돌이 먹이기용: REAL_FRUITS에서 자동 파생 (icon, name, id, color, bg 사용)
const ALL_FOOD_ITEMS = REAL_FRUITS.map(f => ({ id: f.id, name: f.name, icon: f.icon, color: f.color, bg: f.bg }));

// 정답 포함 5개 랜덤 선택지 생성 헬퍼
function pickBearChoices(targetFood) {
  const others = ALL_FOOD_ITEMS.filter(f => f.id !== targetFood.id);
  const shuffled = shuffleArray(others).slice(0, 4);
  return shuffleArray([targetFood, ...shuffled]);
}

// 🎵 Vite 동적 파일 스캐너: public/music/ 폴더 안의 모든 MP3 파일을 자동으로 감지하여 100% 실시간 리스트화!
const musicModules = import.meta.glob('/public/music/*.mp3', { query: '?url', eager: true });

const LOCAL_NURSERY_SONGS = Object.keys(musicModules).map((filePath, i) => {
  const fileName = filePath.split('/').pop();
  const decodedFileName = decodeURIComponent(fileName);
  const rawTitle = decodedFileName.replace(/\.mp3$/i, '').replace(/^\d+\s*/, '');
  return {
    id: `song_${i}_${fileName}`,
    fileName: decodedFileName,
    title: rawTitle,
    url: `/music/${encodeURIComponent(fileName)}`
  };
}).sort((a, b) => a.fileName.localeCompare(b.fileName, 'ko', { numeric: true }));

const RAINBOW_PAINTS = [
  { name: '빨간색 🔴', color: '#ef4444', freq: 523.25 },
  { name: '주황색 🍊', color: '#f97316', freq: 587.33 },
  { name: '노란색 💛', color: '#eab308', freq: 659.25 },
  { name: '초록색 🍏', color: '#10b981', freq: 698.46 },
  { name: '파란색 💙', color: '#3b82f6', freq: 783.99 },
  { name: '남색 🌌', color: '#6366f1', freq: 880.00 },
  { name: '보라색 🔮', color: '#a855f7', freq: 987.77 }
];

// ✏️ 따라쓰기 템플릿 데이터 (숫자 0~9 SVG 가이드)
const TRACING_TEMPLATES = [
  {
    id: 'num0', label: '0', category: '숫자',
    paths: ['M 50 15 C 25 15 25 35 25 50 C 25 65 25 85 50 85 C 75 85 75 65 75 50 C 75 35 75 15 50 15 Z'], viewBox: '0 0 100 100'
  },
  {
    id: 'num1', label: '1', category: '숫자',
    paths: ['M 38 32 L 52 18 L 52 82 M 34 82 L 70 82'], viewBox: '0 0 100 100'
  },
  {
    id: 'num2', label: '2', category: '숫자',
    paths: ['M 25 32 Q 25 12 50 12 Q 75 12 75 32 Q 75 52 50 58 L 25 85 L 75 85'], viewBox: '0 0 100 100'
  },
  {
    id: 'num3', label: '3', category: '숫자',
    paths: ['M 25 15 L 72 15 L 46 46 Q 75 46 75 68 Q 75 90 45 90 Q 25 90 25 78'], viewBox: '0 0 100 100'
  },
  {
    id: 'num4', label: '4', category: '숫자',
    paths: ['M 62 85 L 62 12 L 20 62 L 78 62'], viewBox: '0 0 100 100'
  },
  {
    id: 'num5', label: '5', category: '숫자',
    paths: ['M 70 15 L 32 15 L 28 48 Q 50 36 72 48 Q 80 64 65 82 Q 48 92 25 80'], viewBox: '0 0 100 100'
  },
  {
    id: 'num6', label: '6', category: '숫자',
    paths: ['M 66 22 Q 35 15 28 48 Q 24 64 36 82 Q 52 90 68 82 Q 76 68 74 54 Q 70 42 50 42 Q 34 42 28 54'], viewBox: '0 0 100 100'
  },
  {
    id: 'num7', label: '7', category: '숫자',
    paths: ['M 25 18 L 75 18 L 42 85'], viewBox: '0 0 100 100'
  },
  {
    id: 'num8', label: '8', category: '숫자',
    paths: ['M 50 50 Q 28 50 28 32 Q 28 15 50 15 Q 72 15 72 32 Q 72 50 50 50 Q 28 50 28 68 Q 28 85 50 85 Q 72 85 72 68 Q 72 50 50 50'], viewBox: '0 0 100 100'
  },
  {
    id: 'num9', label: '9', category: '숫자',
    paths: ['M 72 48 Q 72 32 62 20 Q 48 12 34 22 Q 24 34 28 48 Q 36 60 52 60 Q 72 60 72 40 Z M 72 48 L 72 68 Q 70 84 48 88'], viewBox: '0 0 100 100'
  },
];

// 🎨 퐁퐁 스탬프 아이템 목록
const STAMP_ITEMS = [
  { id: 'paw', icon: '🐾', name: '발자국', freq: 650 },
  { id: 'star', icon: '⭐', name: '반짝별', freq: 880 },
  { id: 'heart', icon: '💖', name: '하트', freq: 780 },
  { id: 'rainbow', icon: '🌈', name: '무지개', freq: 980 },
  { id: 'flower', icon: '🌸', name: '예쁜꽃', freq: 700 },
  { id: 'smile', icon: '😊', name: '스마일', freq: 820 },
  { id: 'duck', icon: '🐥', name: '삐약이', freq: 920 },
  { id: 'butterfly', icon: '🦋', name: '나비', freq: 850 },
  { id: 'apple', icon: '🍎', name: '사과', freq: 600 },
  { id: 'strawberry', icon: '🍓', name: '딸기', freq: 740 }
];

// 🦁 동물 친구들 과일 먹이기용 10종 동물 데이터
const FEEDABLE_ANIMALS = [
  { id: 'bear', name: '곰돌이', icon: '🐻', color: '#b45309', bg: '#fef3c7', baseColor: '#C8952E', darkColor: '#A67B1E', snoutColor: '#E8C87A' },
  { id: 'rabbit', name: '토끼', icon: '🐰', color: '#ec4899', bg: '#fce7f3', baseColor: '#FFFFFF', darkColor: '#E9D5FF', snoutColor: '#FFE4E6' },
  { id: 'monkey', name: '원숭이', icon: '🐵', color: '#854d0e', bg: '#fef9c3', baseColor: '#A16207', darkColor: '#78350F', snoutColor: '#FDE68A' },
  { id: 'dog', name: '강아지', icon: '🐶', color: '#ea580c', bg: '#ffedd5', baseColor: '#FB923C', darkColor: '#C2410C', snoutColor: '#FFEDD5' },
  { id: 'cat', name: '고양이', icon: '🐱', color: '#0284c7', bg: '#e0f2fe', baseColor: '#FED7AA', darkColor: '#FB923C', snoutColor: '#FFF7ED' },
  { id: 'panda', name: '판다', icon: '🐼', color: '#334155', bg: '#f1f5f9', baseColor: '#FFFFFF', darkColor: '#1E293B', snoutColor: '#F1F5F9' },
  { id: 'pig', name: '돼지', icon: '🐷', color: '#f43f5e', bg: '#ffe4e6', baseColor: '#FDA4AF', darkColor: '#F43F5E', snoutColor: '#FFE4E6' },
  { id: 'frog', name: '개구리', icon: '🐸', color: '#16a34a', bg: '#dcfce7', baseColor: '#4ADE80', darkColor: '#15803D', snoutColor: '#BBF7D0' },
  { id: 'lion', name: '사자', icon: '🦁', color: '#d97706', bg: '#fef3c7', baseColor: '#FBBF24', darkColor: '#B45309', snoutColor: '#FEF3C7' },
  { id: 'elephant', name: '코끼리', icon: '🐘', color: '#0891b2', bg: '#cffafe', baseColor: '#93C5FD', darkColor: '#3B82F6', snoutColor: '#DBEAFE' }
];

// 3마리 랜덤 동물 + 1마리 목표 요청 동물 + 음식 1개 + 선택지 5개 라운드 생성 헬퍼
function pickFeedRound() {
  const shuffledAnimals = [...FEEDABLE_ANIMALS].sort(() => 0.5 - Math.random());
  const threeAnimals = shuffledAnimals.slice(0, 3);
  const target = threeAnimals[Math.floor(Math.random() * threeAnimals.length)];
  const food = ALL_FOOD_ITEMS[Math.floor(Math.random() * ALL_FOOD_ITEMS.length)];
  const choices = pickBearChoices(food);
  return { threeAnimals, target, food, choices };
}

// =============================================================================
// 🐾 SVG 애니메이션 다채로운 동물 캐릭터 컴포넌트 (곰, 토끼, 원숭이, 강아지, 고양이, 판다 등)
// =============================================================================
function AnimatedAnimalCharacter({ animal, mood = 'hungry', isOver = false, rejectedFoodIcon = null, isTarget = false }) {
  const [chewOpen, setChewOpen] = React.useState(false);

  React.useEffect(() => {
    if (mood === 'eating') {
      const interval = setInterval(() => setChewOpen(prev => !prev), 180);
      return () => clearInterval(interval);
    }
    setChewOpen(false);
  }, [mood]);

  const dm = isOver && mood === 'hungry' ? 'mouth-open' : mood;

  const bodyClass = dm === 'happy' ? 'bear-bounce'
    : dm === 'eating' ? 'bear-munch'
      : dm === 'reject' ? 'bear-reject'
        : 'bear-idle';

  // 공통 반짝이 및 거절 이펙트 헬퍼
  const renderFX = () => (
    <>
      {dm === 'happy' && (
        <>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '0', left: '8px', fontSize: '1.4rem' }}>✨</div>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '10px', right: '2px', fontSize: '1.2rem', animationDelay: '0.15s' }}>⭐</div>
          <div className="bear-sparkle" style={{ position: 'absolute', bottom: '40px', left: '0', fontSize: '1.3rem', animationDelay: '0.35s' }}>💖</div>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '-5px', right: '28px', fontSize: '1.1rem', animationDelay: '0.5s' }}>🌟</div>
        </>
      )}
      {dm === 'reject' && rejectedFoodIcon && (
        <div className="bear-fruit-reject" style={{
          position: 'absolute', top: '38%', left: '50%',
          fontSize: '2.2rem', pointerEvents: 'none'
        }}>{rejectedFoodIcon}</div>
      )}
    </>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐱 1. 고양이 (Cat)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'cat') {
    const catBase = '#FB923C';
    const catDark = '#EA580C';
    const catWhite = '#FFF7ED';
    const catPink = '#F472B6';
    const pawLeft = dm === 'happy' ? { cx: 48, cy: 120 } : dm === 'reject' ? { cx: 72, cy: 155 } : { cx: 78, cy: 196 };
    const pawRight = dm === 'happy' ? { cx: 152, cy: 120 } : dm === 'reject' ? { cx: 128, cy: 155 } : { cx: 122, cy: 196 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          <path d={dm === 'happy' ? "M 135 195 C 175 190, 195 145, 185 105 C 182 95, 168 98, 172 110 C 180 138, 162 175, 130 182" : "M 135 195 C 170 195, 188 175, 180 140 C 177 130, 163 133, 167 145 C 172 165, 158 185, 130 185"}
            fill={catBase} stroke={catDark} strokeWidth="2.5" />
          <path d="M 62 145 C 50 170, 52 205, 68 215 C 85 220, 115 220, 132 215 C 148 205, 150 170, 138 145 C 125 130, 75 130, 62 145 Z"
            fill={catBase} stroke={catDark} strokeWidth="2.5" />
          <path d="M 82 142 C 75 160, 78 190, 100 202 C 122 190, 125 160, 118 142 C 108 135, 92 135, 82 142 Z" fill={catWhite} />
          <path d="M 58 170 Q 70 172 76 170 M 56 186 Q 68 188 74 185 M 142 170 Q 130 172 124 170 M 144 186 Q 132 188 126 185" stroke={catDark} strokeWidth="3" strokeLinecap="round" fill="none" />
          <g>
            <path d="M 46 88 L 38 24 C 44 22, 64 36, 78 55 Z" fill={catBase} stroke={catDark} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M 48 80 L 44 34 C 48 33, 62 43, 72 58 Z" fill={catPink} />
            <path d="M 154 88 L 162 24 C 156 22, 136 36, 122 55 Z" fill={catBase} stroke={catDark} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M 152 80 L 156 34 C 152 33, 138 43, 128 58 Z" fill={catPink} />
          </g>
          <path d="M 50 82 C 40 102, 50 128, 75 134 C 90 137, 110 137, 125 134 C 150 128, 160 102, 150 82 C 142 60, 58 60, 50 82 Z" fill={catBase} stroke={catDark} strokeWidth="2.5" />
          <path d="M 92 56 L 95 68 L 100 58 L 105 68 L 108 56" stroke={catDark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx="88" cy="112" rx="16" ry="12" fill={catWhite} />
          <ellipse cx="112" cy="112" rx="16" ry="12" fill={catWhite} />
          <g stroke="#78350F" strokeWidth="2.2" strokeLinecap="round">
            <line x1="32" y1="104" x2="72" y2="108" /><line x1="30" y1="115" x2="70" y2="114" /><line x1="34" y1="126" x2="72" y2="120" />
            <line x1="168" y1="104" x2="128" y2="108" /><line x1="170" y1="115" x2="130" y2="114" /><line x1="166" y1="126" x2="128" y2="120" />
          </g>
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 80) scale(1.05)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EC4899" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 80) scale(1.05)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EC4899" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 84 L 86 94 M 68 94 L 86 84 M 114 84 L 132 94 M 114 94 L 132 84" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 66 90 Q 78 80 90 90 M 110 90 Q 122 80 134 90" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : dm === 'mouth-open' ? (
            <>
              <ellipse cx="78" cy="88" rx="10" ry="12" fill="#047857" /><circle cx="75" cy="84" r="3.5" fill="#FFFFFF" />
              <ellipse cx="122" cy="88" rx="10" ry="12" fill="#047857" /><circle cx="119" cy="84" r="3.5" fill="#FFFFFF" />
            </>
          ) : (
            <>
              <ellipse cx="78" cy="88" rx="9" ry="10" fill="#059669" /><circle cx="76" cy="85" r="3" fill="#FFFFFF" />
              <ellipse cx="122" cy="88" rx="9" ry="10" fill="#059669" /><circle cx="120" cy="85" r="3" fill="#FFFFFF" />
            </>
          )}
          <polygon points="94,103 106,103 100,109" fill={catPink} />
          {dm === 'mouth-open' ? (
            <path d="M 88 111 Q 94 112 100 110 Q 106 112 112 111 C 112 126, 88 126, 88 111 Z" fill="#E11D48" stroke="#78350F" strokeWidth="2.2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="116" rx="9" ry={chewOpen ? 10 : 3} fill="#E11D48" stroke="#78350F" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 90 116 Q 100 110 110 116" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 89 110 Q 95 116 100 111 Q 105 116 111 110" stroke="#78350F" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          )}
          <ellipse cx="58" cy="106" rx="10" ry="7" fill="#F43F5E" opacity={dm === 'happy' ? 0.75 : 0.4} />
          <ellipse cx="142" cy="106" rx="10" ry="7" fill="#F43F5E" opacity={dm === 'happy' ? 0.75 : 0.4} />
          <ellipse cx={pawLeft.cx} cy={pawLeft.cy} rx="16" ry="12" fill={catWhite} stroke={catDark} strokeWidth="2" />
          <ellipse cx={pawRight.cx} cy={pawRight.cy} rx="16" ry="12" fill={catWhite} stroke={catDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐸 2. 개구리 (Frog)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'frog') {
    const frogBase = '#4ADE80';
    const frogDark = '#15803D';
    const frogBelly = '#FEF08A';
    const frogMouth = '#047857';
    const handLeft = dm === 'happy' ? { x: 34, y: 110 } : dm === 'reject' ? { x: 55, y: 155 } : { x: 38, y: 185 };
    const handRight = dm === 'happy' ? { x: 166, y: 110 } : dm === 'reject' ? { x: 145, y: 155 } : { x: 162, y: 185 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          <ellipse cx="44" cy="195" rx="26" ry="18" fill={frogBase} stroke={frogDark} strokeWidth="2.5" transform="rotate(-20 44 195)" />
          <ellipse cx="156" cy="195" rx="26" ry="18" fill={frogBase} stroke={frogDark} strokeWidth="2.5" transform="rotate(20 156 195)" />
          <ellipse cx="100" cy="175" rx="55" ry="46" fill={frogBase} stroke={frogDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="180" rx="36" ry="32" fill={frogBelly} opacity="0.9" />
          <g>
            <line x1="65" y1="165" x2={handLeft.x} y2={handLeft.y} stroke={frogDark} strokeWidth="7" strokeLinecap="round" />
            <circle cx={handLeft.x - 7} cy={handLeft.y - 6} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handLeft.x} cy={handLeft.y - 9} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handLeft.x + 7} cy={handLeft.y - 6} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <line x1="135" y1="165" x2={handRight.x} y2={handRight.y} stroke={frogDark} strokeWidth="7" strokeLinecap="round" />
            <circle cx={handRight.x - 7} cy={handRight.y - 6} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handRight.x} cy={handRight.y - 9} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handRight.x + 7} cy={handRight.y - 6} r="6.5" fill={frogBase} stroke={frogDark} strokeWidth="2" />
          </g>
          <circle cx="58" cy="52" r="30" fill={frogBase} stroke={frogDark} strokeWidth="2.5" />
          <circle cx="142" cy="52" r="30" fill={frogBase} stroke={frogDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="100" rx="68" ry="46" fill={frogBase} stroke={frogDark} strokeWidth="2.5" />
          {dm === 'happy' ? (
            <>
              <g transform="translate(50, 42) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(134, 42) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 46 44 L 70 60 M 46 60 L 70 44 M 130 44 L 154 60 M 130 60 L 154 44" stroke="#064E3B" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 44 54 Q 58 40 72 54 M 128 54 Q 142 40 156 54" stroke="#064E3B" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            </>
          ) : dm === 'mouth-open' ? (
            <>
              <circle cx="58" cy="52" r="22" fill="#FFFFFF" /><circle cx="60" cy="52" r="14" fill="#0F172A" /><circle cx="56" cy="47" r="5" fill="#FFFFFF" />
              <circle cx="142" cy="52" r="22" fill="#FFFFFF" /><circle cx="140" cy="52" r="14" fill="#0F172A" /><circle cx="136" cy="47" r="5" fill="#FFFFFF" />
            </>
          ) : (
            <>
              <circle cx="58" cy="52" r="21" fill="#FFFFFF" /><circle cx="60" cy="52" r="12" fill="#0F172A" /><circle cx="57" cy="48" r="4.5" fill="#FFFFFF" />
              <circle cx="142" cy="52" r="21" fill="#FFFFFF" /><circle cx="140" cy="52" r="12" fill="#0F172A" /><circle cx="137" cy="48" r="4.5" fill="#FFFFFF" />
            </>
          )}
          <circle cx="94" cy="90" r="2.5" fill={frogMouth} /><circle cx="106" cy="90" r="2.5" fill={frogMouth} />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="112" rx="34" ry="19" fill="#E11D48" stroke={frogDark} strokeWidth="3" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="112" rx="28" ry={chewOpen ? 16 : 4} fill="#E11D48" stroke={frogDark} strokeWidth="3" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 64 116 Q 100 96 136 116" stroke={frogMouth} strokeWidth="4" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 60 106 Q 100 126 140 106" stroke={frogMouth} strokeWidth="3.8" strokeLinecap="round" fill="none" />
          )}
          <circle cx="48" cy="112" r="14" fill="#FB7185" opacity={dm === 'happy' ? 0.8 : 0.45} />
          <circle cx="152" cy="112" r="14" fill="#FB7185" opacity={dm === 'happy' ? 0.8 : 0.45} />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐵 3. 원숭이 (Monkey)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'monkey') {
    const monkBase = '#854D0E';
    const monkDark = '#713F12';
    const monkFace = '#FDE68A';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 긴 원숭이 꼬리 (원형으로 말림) */}
          <path d={dm === 'happy' ? "M 140 190 C 185 190, 205 130, 185 100 C 170 75, 145 95, 160 115 C 175 135, 165 175, 130 180" : "M 140 190 C 180 190, 195 155, 175 130 C 160 110, 145 125, 155 145 C 165 165, 155 185, 130 185"}
            fill="none" stroke={monkBase} strokeWidth="11" strokeLinecap="round" />
          
          {/* 팔 */}
          <path d={armL} stroke={monkBase} strokeWidth="14" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={monkBase} strokeWidth="14" strokeLinecap="round" fill="none" />

          {/* 몸통 */}
          <ellipse cx="100" cy="178" rx="52" ry="46" fill={monkBase} stroke={monkDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="182" rx="30" ry="26" fill={monkFace} />

          {/* 튀어나온 큼직한 원숭이 귀 2개 */}
          <g>
            <circle cx="38" cy="85" r="24" fill={monkBase} stroke={monkDark} strokeWidth="2" />
            <circle cx="38" cy="85" r="14" fill={monkFace} />
            <circle cx="162" cy="85" r="24" fill={monkBase} stroke={monkDark} strokeWidth="2" />
            <circle cx="162" cy="85" r="14" fill={monkFace} />
          </g>

          {/* 원숭이 머리 본체 */}
          <circle cx="100" cy="86" r="54" fill={monkBase} stroke={monkDark} strokeWidth="2" />

          {/* 하트 모양 살구빛 원숭이 얼굴 패치 */}
          <ellipse cx="84" cy="74" rx="20" ry="22" fill={monkFace} />
          <ellipse cx="116" cy="74" rx="20" ry="22" fill={monkFace} />
          <ellipse cx="100" cy="98" rx="38" ry="28" fill={monkFace} />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 70 72 L 88 82 M 70 82 L 88 72 M 112 72 L 130 82 M 112 82 L 130 72" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 78 Q 78 68 88 78 M 112 78 Q 122 68 132 78" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="80" cy="76" r="6" fill="#451A03" /><circle cx="82" cy="74" r="2.2" fill="#FFFFFF" />
              <circle cx="120" cy="76" r="6" fill="#451A03" /><circle cx="122" cy="74" r="2.2" fill="#FFFFFF" />
            </>
          )}

          {/* 작은 원숭이 콧구멍 */}
          <circle cx="95" cy="94" r="2.2" fill="#78350F" />
          <circle cx="105" cy="94" r="2.2" fill="#78350F" />

          {/* 원숭이 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="110" rx="16" ry="14" fill="#DC2626" stroke="#451A03" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="110" rx="13" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#451A03" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 112 Q 100 104 112 112" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 85 106 Q 100 118 115 106" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          <circle cx="62" cy="96" r="9" fill="#F43F5E" opacity={dm === 'happy' ? 0.7 : 0.35} />
          <circle cx="138" cy="96" r="9" fill="#F43F5E" opacity={dm === 'happy' ? 0.7 : 0.35} />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐰 4. 토끼 (Rabbit)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'rabbit') {
    const rabWhite = '#FFFFFF';
    const rabPink = '#F472B6';
    const rabDark = '#E2E8F0';
    const pawL = dm === 'happy' ? { cx: 58, cy: 125 } : dm === 'reject' ? { cx: 75, cy: 155 } : { cx: 78, cy: 190 };
    const pawR = dm === 'happy' ? { cx: 142, cy: 125 } : dm === 'reject' ? { cx: 125, cy: 155 } : { cx: 122, cy: 190 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 복슬복슬 솜꼬리 */}
          <circle cx="150" cy="190" r="16" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />

          {/* 몸통 */}
          <ellipse cx="100" cy="175" rx="50" ry="46" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />
          <ellipse cx="100" cy="180" rx="30" ry="26" fill="#FFF1F2" />

          {/* 머리 위로 길게 뻗은 쫑긋한 토끼 긴 귀 2개 */}
          <g>
            <path d="M 52 75 C 35 30, 48 -5, 68 -2 C 86 -2, 85 40, 78 75 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />
            <path d="M 58 65 C 48 30, 56 6, 68 8 C 80 8, 78 40, 72 65 Z" fill={rabPink} />

            <path d="M 148 75 C 165 30, 152 -5, 132 -2 C 114 -2, 115 40, 122 75 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />
            <path d="M 142 65 C 152 30, 144 6, 132 8 C 120 8, 122 40, 128 65 Z" fill={rabPink} />
          </g>

          {/* 둥근 토끼 머리 */}
          <circle cx="100" cy="94" r="50" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />

          {/* 볼살 패치 */}
          <ellipse cx="86" cy="108" rx="16" ry="12" fill="#FFF1F2" />
          <ellipse cx="114" cy="108" rx="16" ry="12" fill="#FFF1F2" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 84) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 84) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 88 L 86 98 M 68 98 L 86 88 M 114 88 L 132 98 M 114 98 L 132 88" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 92 Q 78 82 88 92 M 112 92 Q 122 82 132 92" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="80" cy="90" r="7" fill="#E11D48" /><circle cx="78" cy="87" r="3" fill="#FFFFFF" />
              <circle cx="120" cy="90" r="7" fill="#E11D48" /><circle cx="118" cy="87" r="3" fill="#FFFFFF" />
            </>
          )}

          {/* 작은 핑크 코 */}
          <polygon points="95,100 105,100 100,105" fill={rabPink} />

          {/* 톡 튀어나온 토끼 앞니 2개 & 입 */}
          <rect x="94.5" y="108" width="5" height="7" rx="1.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <rect x="100.5" y="108" width="5" height="7" rx="1.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="118" rx="12" ry="12" fill="#E11D48" stroke="#334155" strokeWidth="1.5" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="118" rx="10" ry={chewOpen ? 9 : 2} fill="#E11D48" stroke="#334155" strokeWidth="1.5" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 90 115 Q 100 110 110 115" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 90 108 Q 95 113 100 108 Q 105 113 110 108" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />
          )}

          {/* 토끼 수염 */}
          <g stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round">
            <line x1="45" y1="104" x2="72" y2="108" /><line x1="45" y1="114" x2="72" y2="114" />
            <line x1="155" y1="104" x2="128" y2="108" /><line x1="155" y1="114" x2="128" y2="114" />
          </g>

          <circle cx="64" cy="106" r="10" fill="#FDA4AF" opacity="0.6" />
          <circle cx="136" cy="106" r="10" fill="#FDA4AF" opacity="0.6" />

          {/* 솜방망이 앞발 */}
          <ellipse cx={pawL.cx} cy={pawL.cy} rx="15" ry="12" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />
          <ellipse cx={pawR.cx} cy={pawR.cy} rx="15" ry="12" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐶 5. 강아지 (Dog)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'dog') {
    const dogBase = '#F59E0B';
    const dogDark = '#B45309';
    const dogSnout = '#FEF3C7';
    const earRotL = dm === 'happy' ? -25 : 15;
    const earRotR = dm === 'happy' ? 25 : -15;

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 살랑살랑 강아지 꼬리 */}
          <path d={dm === 'happy' ? "M 135 190 Q 185 180 180 130" : "M 135 190 Q 170 185 165 155"}
            stroke={dogBase} strokeWidth="12" strokeLinecap="round" fill="none" />

          {/* 몸통 */}
          <ellipse cx="100" cy="178" rx="54" ry="48" fill={dogBase} stroke={dogDark} strokeWidth="2" />
          <ellipse cx="100" cy="182" rx="30" ry="26" fill={dogSnout} />

          {/* 빨간 목걸이 & 노란 방울 */}
          <rect x="74" y="142" width="52" height="9" rx="4.5" fill="#EF4444" />
          <circle cx="100" cy="151" r="6" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />

          {/* 접힌 강아지 귀 2개 (플로피 이어) */}
          <ellipse cx="44" cy="72" rx="16" ry="32" fill={dogDark} transform={`rotate(${earRotL} 44 72)`} />
          <ellipse cx="156" cy="72" rx="16" ry="32" fill={dogDark} transform={`rotate(${earRotR} 156 72)`} />

          {/* 머리 본체 */}
          <circle cx="100" cy="88" r="52" fill={dogBase} stroke={dogDark} strokeWidth="2" />

          {/* 눈 얼룩 패치 */}
          <ellipse cx="78" cy="80" rx="18" ry="16" fill={dogDark} opacity="0.35" transform="rotate(-10 78 80)" />

          {/* 강아지 흰 주둥이 패치 */}
          <ellipse cx="100" cy="100" rx="32" ry="24" fill={dogSnout} />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 75) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 75) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 76 L 86 86 M 68 86 L 86 76 M 114 76 L 132 86 M 114 86 L 132 76" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 82 Q 78 72 88 82 M 112 82 Q 122 72 132 82" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="80" cy="80" r="6.5" fill="#1C1917" /><circle cx="78" cy="77" r="2.5" fill="#FFFFFF" />
              <circle cx="120" cy="80" r="6.5" fill="#1C1917" /><circle cx="118" cy="77" r="2.5" fill="#FFFFFF" />
            </>
          )}

          {/* 촉촉하고 큰 강아지 코 */}
          <ellipse cx="100" cy="94" rx="10" ry="7.5" fill="#1C1917" />
          <ellipse cx="98" cy="92" rx="3" ry="1.8" fill="#78716C" opacity="0.6" />

          {/* 빼꼼 나온 강아지 혓바닥 & 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="112" rx="14" ry="14" fill="#DC2626" stroke="#1C1917" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="112" rx="11" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#1C1917" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 110 Q 100 102 112 110" stroke="#1C1917" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <>
              <path d="M 88 104 Q 94 110 100 106 Q 106 110 112 104" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* 혓바닥 */}
              <path d="M 96 108 C 96 118, 104 118, 104 108 Z" fill="#F43F5E" />
            </>
          )}

          <circle cx="62" cy="98" r="9" fill="#F43F5E" opacity="0.4" />
          <circle cx="138" cy="98" r="9" fill="#F43F5E" opacity="0.4" />

          {/* 앞발 */}
          <ellipse cx="74" cy="195" rx="16" ry="12" fill={dogSnout} stroke={dogDark} strokeWidth="2" />
          <ellipse cx="126" cy="195" rx="16" ry="12" fill={dogSnout} stroke={dogDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🦁 6. 사자 (Lion)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'lion') {
    const lionBase = '#FBBF24';
    const lionMane = '#B45309';
    const lionManeDark = '#92400E';
    const lionSnout = '#FEF3C7';

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 붓 모양 털뭉치 꼬리 */}
          <path d="M 135 190 Q 185 180 180 140" stroke={lionBase} strokeWidth="10" strokeLinecap="round" fill="none" />
          <ellipse cx="180" cy="135" rx="12" ry="16" fill={lionMane} />

          {/* 몸통 */}
          <ellipse cx="100" cy="180" rx="55" ry="48" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
          <ellipse cx="100" cy="184" rx="32" ry="26" fill={lionSnout} />

          {/* 사자의 웅장한 갈기털 (Mane) */}
          <circle cx="100" cy="88" r="66" fill={lionMane} stroke={lionManeDark} strokeWidth="3" />
          <path d="M 40 88 C 40 45, 65 30, 100 30 C 135 30, 160 45, 160 88 C 160 135, 135 152, 100 152 C 65 152, 40 135, 40 88 Z" fill="#D97706" opacity="0.4" />

          {/* 둥근 귀 */}
          <circle cx="56" cy="46" r="16" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
          <circle cx="56" cy="46" r="9" fill={lionMane} />
          <circle cx="144" cy="46" r="16" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
          <circle cx="144" cy="46" r="9" fill={lionMane} />

          {/* 얼굴 본체 */}
          <circle cx="100" cy="88" r="48" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />

          {/* 사자 주둥이 패치 */}
          <ellipse cx="100" cy="98" rx="28" ry="20" fill={lionSnout} />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(72, 74) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(112, 74) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 70 76 L 88 86 M 70 86 L 88 76 M 112 76 L 130 86 M 112 86 L 130 76" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 70 80 Q 80 70 90 80 M 110 80 Q 120 70 130 80" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="82" cy="78" r="6" fill="#1C1917" /><circle cx="80" cy="75" r="2.5" fill="#FFFFFF" />
              <circle cx="118" cy="78" r="6" fill="#1C1917" /><circle cx="116" cy="75" r="2.5" fill="#FFFFFF" />
            </>
          )}

          {/* 사자 코 & 입 */}
          <polygon points="93,92 107,92 100,99" fill="#78350F" />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="110" rx="15" ry="14" fill="#DC2626" stroke="#451A03" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="110" rx="12" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#451A03" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 110 Q 100 102 112 110" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 88 104 Q 94 110 100 106 Q 106 110 112 104" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          {/* 수염 */}
          <g stroke="#78350F" strokeWidth="1.8" strokeLinecap="round">
            <line x1="58" y1="98" x2="78" y2="102" /><line x1="58" y1="106" x2="78" y2="106" />
            <line x1="142" y1="98" x2="122" y2="102" /><line x1="142" y1="106" x2="122" y2="106" />
          </g>

          {/* 앞발 */}
          <ellipse cx="72" cy="196" rx="18" ry="12" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
          <ellipse cx="128" cy="196" rx="18" ry="12" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐘 7. 코끼리 (Elephant)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'elephant') {
    const eleBase = '#93C5FD';
    const eleDark = '#2563EB';
    const eleInner = '#DBEAFE';
    const trunkD = dm === 'happy' || dm === 'eating'
      ? "M 100 96 Q 90 125 115 135 Q 130 140 135 120"
      : dm === 'mouth-open'
        ? "M 100 96 Q 90 120 125 125"
        : "M 100 96 Q 95 130 108 145 Q 118 150 124 138";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 거대한 부채꼴 귀 2개 */}
          <ellipse cx="36" cy="85" rx="32" ry="38" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />
          <ellipse cx="38" cy="85" rx="18" ry="24" fill={eleInner} />
          <ellipse cx="164" cy="85" rx="32" ry="38" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />
          <ellipse cx="162" cy="85" rx="18" ry="24" fill={eleInner} />

          {/* 몸통 */}
          <ellipse cx="100" cy="180" rx="58" ry="50" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="185" rx="34" ry="28" fill={eleInner} opacity="0.8" />

          {/* 머리 */}
          <circle cx="100" cy="88" r="50" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />

          {/* 하얀 앙증맞은 상아 2개 (Tusks) */}
          <path d="M 85 105 Q 72 120 68 112 Q 78 100 85 105 Z" fill="#FFFFFF" stroke={eleDark} strokeWidth="1.5" />
          <path d="M 115 105 Q 128 120 132 112 Q 122 100 115 105 Z" fill="#FFFFFF" stroke={eleDark} strokeWidth="1.5" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 76 L 86 86 M 68 86 L 86 76 M 114 76 L 132 86 M 114 86 L 132 76" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 80 Q 78 70 88 80 M 112 80 Q 122 70 132 80" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="80" cy="78" r="6" fill="#1E3A8A" /><circle cx="78" cy="75" r="2.5" fill="#FFFFFF" />
              <circle cx="120" cy="78" r="6" fill="#1E3A8A" /><circle cx="118" cy="75" r="2.5" fill="#FFFFFF" />
            </>
          )}

          {/* 코끼리 긴 코 (Trunk) */}
          <path d={trunkD} stroke={eleBase} strokeWidth="18" strokeLinecap="round" fill="none" />
          <path d={trunkD} stroke={eleDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* 홍조 */}
          <circle cx="58" cy="98" r="10" fill="#F43F5E" opacity="0.45" />
          <circle cx="142" cy="98" r="10" fill="#F43F5E" opacity="0.45" />

          {/* 기둥 발 */}
          <rect x="58" y="185" width="28" height="24" rx="8" fill={eleBase} stroke={eleDark} strokeWidth="2" />
          <rect x="114" y="185" width="28" height="24" rx="8" fill={eleBase} stroke={eleDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐼 8. 판다 (Panda)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'panda') {
    const panWhite = '#FFFFFF';
    const panBlack = '#1E293B';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 검은 어깨 팔 */}
          <path d={armL} stroke={panBlack} strokeWidth="18" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={panBlack} strokeWidth="18" strokeLinecap="round" fill="none" />

          {/* 하얀 몸통 */}
          <ellipse cx="100" cy="180" rx="56" ry="50" fill={panWhite} stroke="#CBD5E1" strokeWidth="2" />
          <ellipse cx="100" cy="150" rx="46" ry="16" fill={panBlack} opacity="0.9" />

          {/* 까맣고 동글동글한 판다 귀 2개 */}
          <circle cx="56" cy="45" r="22" fill={panBlack} />
          <circle cx="144" cy="45" r="22" fill={panBlack} />

          {/* 하얀 머리 */}
          <circle cx="100" cy="90" r="54" fill={panWhite} stroke="#CBD5E1" strokeWidth="2" />

          {/* 판다의 상징: 검은색 타원형 눈 패치 2개 */}
          <ellipse cx="76" cy="80" rx="16" ry="13" fill={panBlack} transform="rotate(-15 76 80)" />
          <ellipse cx="124" cy="80" rx="16" ry="13" fill={panBlack} transform="rotate(15 124 80)" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(68, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(116, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 76 L 84 84 M 68 84 L 84 76 M 116 76 L 132 84 M 116 84 L 132 76" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 80 Q 76 72 84 80 M 116 80 Q 124 72 132 80" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="76" cy="80" r="4.5" fill="#FFFFFF" /><circle cx="76" cy="80" r="2" fill="#0F172A" />
              <circle cx="124" cy="80" r="4.5" fill="#FFFFFF" /><circle cx="124" cy="80" r="2" fill="#0F172A" />
            </>
          )}

          {/* 둥근 코 & 입 */}
          <ellipse cx="100" cy="98" rx="8" ry="6" fill={panBlack} />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="114" rx="14" ry="14" fill="#DC2626" stroke={panBlack} strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="114" rx="11" ry={chewOpen ? 11 : 3} fill="#DC2626" stroke={panBlack} strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 114 Q 100 106 112 114" stroke={panBlack} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 88 108 Q 94 114 100 110 Q 106 114 112 108" stroke={panBlack} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          )}

          <circle cx="60" cy="102" r="10" fill="#FDA4AF" opacity="0.6" />
          <circle cx="140" cy="102" r="10" fill="#FDA4AF" opacity="0.6" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐷 9. 돼지 (Pig)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'pig') {
    const pigPink = '#FDA4AF';
    const pigDark = '#F43F5E';
    const pigSnout = '#FB7185';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 돼지 꼬불꼬불 꼬리 (스프링 모양) */}
          <path d={dm === 'happy' ? "M 140 190 Q 170 175 165 155 Q 160 135 175 140" : "M 140 190 Q 165 180 160 165 Q 155 150 170 155"}
            stroke={pigDark} strokeWidth="5" strokeLinecap="round" fill="none" />

          {/* 팔 */}
          <path d={armL} stroke={pigDark} strokeWidth="15" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={pigDark} strokeWidth="15" strokeLinecap="round" fill="none" />

          {/* 포동포동 몸통 */}
          <ellipse cx="100" cy="178" rx="56" ry="50" fill={pigPink} stroke={pigDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="182" rx="32" ry="28" fill="#FFF1F2" />

          {/* 접힌 뾰족 돼지 귀 2개 */}
          <polygon points="45,68 62,25 84,55" fill={pigDark} />
          <polygon points="48,64 62,32 78,54" fill="#FFE4E6" />
          <polygon points="155,68 138,25 116,55" fill={pigDark} />
          <polygon points="152,64 138,32 122,54" fill="#FFE4E6" />

          {/* 머리 */}
          <circle cx="100" cy="88" r="52" fill={pigPink} stroke={pigDark} strokeWidth="2.5" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 74 L 86 84 M 68 84 L 86 74 M 114 74 L 132 84 M 114 84 L 132 74" stroke="#881337" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 68 78 Q 78 68 88 78 M 112 78 Q 122 68 132 78" stroke="#881337" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="80" cy="76" r="6" fill="#881337" /><circle cx="78" cy="73" r="2.2" fill="#FFFFFF" />
              <circle cx="120" cy="76" r="6" fill="#881337" /><circle cx="118" cy="73" r="2.2" fill="#FFFFFF" />
            </>
          )}

          {/* 큼직한 타원형 돼지 코 (Snout) & 콧구멍 2개 */}
          <ellipse cx="100" cy="98" rx="22" ry="15" fill={pigSnout} stroke={pigDark} strokeWidth="2" />
          <circle cx="93" cy="98" r="4.5" fill="#881337" />
          <circle cx="107" cy="98" r="4.5" fill="#881337" />

          {/* 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="120" rx="14" ry="14" fill="#DC2626" stroke="#881337" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="120" rx="11" ry={chewOpen ? 11 : 3} fill="#DC2626" stroke="#881337" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 120 Q 100 112 112 120" stroke="#881337" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 88 116 Q 100 125 112 116" stroke="#881337" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          <circle cx="60" cy="98" r="10" fill="#F43F5E" opacity="0.5" />
          <circle cx="140" cy="98" r="10" fill="#F43F5E" opacity="0.5" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐻 10. 곰돌이 (Bear)
  // ═════════════════════════════════════════════════════════════════════════════
  const bearBase = '#C8952E';
  const bearDark = '#A67B1E';
  const bearSnout = '#E8C87A';
  const armL = dm === 'happy' ? "M 48 160 Q 12 118 22 88" : dm === 'reject' ? "M 48 160 Q 50 140 80 148" : "M 48 160 Q 28 175 22 198";
  const armR = dm === 'happy' ? "M 152 160 Q 188 118 178 88" : dm === 'reject' ? "M 152 160 Q 150 140 120 148" : "M 152 160 Q 172 175 178 198";

  return (
    <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
      <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <path d={armL} stroke={bearDark} strokeWidth="15" strokeLinecap="round" fill="none" style={{ transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <path d={armR} stroke={bearDark} strokeWidth="15" strokeLinecap="round" fill="none" style={{ transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <ellipse cx="100" cy="178" rx="56" ry="50" fill={bearBase} />
        <ellipse cx="100" cy="182" rx="32" ry="28" fill={bearSnout} opacity="0.85" />
        <circle cx="56" cy="42" r="21" fill={bearDark} />
        <circle cx="144" cy="42" r="21" fill={bearDark} />
        <circle cx="56" cy="42" r="11" fill="#FFCAD4" />
        <circle cx="144" cy="42" r="11" fill="#FFCAD4" />
        <circle cx="100" cy="88" r="54" fill={bearBase} />
        <ellipse cx="100" cy="96" rx="33" ry="27" fill={bearSnout} />

        {dm === 'happy' ? (
          <>
            <g transform="translate(72, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#ef4444" className="bear-heart-pulse" /></g>
            <g transform="translate(112, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#ef4444" className="bear-heart-pulse" /></g>
          </>
        ) : dm === 'reject' ? (
          <>
            <path d="M 73 74 L 89 82 M 73 82 L 89 74 M 111 74 L 127 82 M 111 82 L 127 74" stroke="#3E2723" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </>
        ) : dm === 'eating' ? (
          <>
            <path d="M 72 80 Q 80 73 88 80 M 112 80 Q 120 73 128 80" stroke="#3E2723" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="82" cy="78" r="5.5" fill="#3E2723" /><circle cx="84" cy="76" r="2" fill="white" />
            <circle cx="118" cy="78" r="5.5" fill="#3E2723" /><circle cx="120" cy="76" r="2" fill="white" />
          </>
        )}

        <ellipse cx="100" cy="92" rx="7" ry="5.5" fill="#3E2723" />
        {dm === 'mouth-open' ? (
          <ellipse cx="100" cy="108" rx="13" ry="15" fill="#D32F2F" stroke="#3E2723" strokeWidth="2" className="bear-mouth-open-anim" />
        ) : dm === 'eating' ? (
          <ellipse cx="100" cy="106" rx="11" ry={chewOpen ? 14 : 4} fill="#D32F2F" stroke="#3E2723" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
        ) : dm === 'reject' ? (
          <path d="M 86 106 Q 93 98 100 102 Q 107 98 114 106" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M 88 102 Q 100 113 112 102" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        )}

        <circle cx="62" cy="94" r="11" fill="#FF9999" opacity={dm === 'happy' ? 0.75 : 0.3} />
        <circle cx="138" cy="94" r="11" fill="#FF9999" opacity={dm === 'happy' ? 0.75 : 0.3} />
      </svg>
      {renderFX()}
    </div>
  );
}

// 🎈 퐁퐁 풍선 데이터
const INITIAL_BALLOONS = [
  { id: 1, color: '#ef4444', icon: '🐶', name: '강아지', left: 15, size: 90 },
  { id: 2, color: '#3b82f6', icon: '🐱', name: '고양이', left: 35, size: 100 },
  { id: 3, color: '#10b981', icon: '🦁', name: '사자', left: 55, size: 85 },
  { id: 4, color: '#f59e0b', icon: '🐮', name: '소', left: 75, size: 110 },
  { id: 5, color: '#ec4899', icon: '🐰', name: '토끼', left: 25, size: 95 },
  { id: 6, color: '#8b5cf6', icon: '🐼', name: '판다', left: 65, size: 105 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('animal');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIpadFrame, setIsIpadFrame] = useState(true);

  // 탭 전환 시마다 동물 및 과일/채소 카드 무작위 셔플
  const [animalItems, setAnimalItems] = useState(() => shuffleArray(REAL_ANIMALS));
  const [fruitItems, setFruitItems] = useState(() => shuffleArray(REAL_FRUITS));

  useEffect(() => {
    if (activeTab === 'animal') {
      setAnimalItems(shuffleArray(REAL_ANIMALS));
    } else if (activeTab === 'fruit') {
      setFruitItems(shuffleArray(REAL_FRUITS));
    }
  }, [activeTab]);

  const [selectedRealItem, setSelectedRealItem] = useState(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);

  // 🦁 3마리 동물 과일 먹이기 상태
  const [feedRound, setFeedRound] = useState(() => pickFeedRound());
  const [animalMoods, setAnimalMoods] = useState({}); // { [animalId]: 'hungry' | 'eating' | 'happy' | 'reject' }
  const [feedScore, setFeedScore] = useState(0);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [hoverAnimalId, setHoverAnimalId] = useState(null);
  const [rejectedAnimalId, setRejectedAnimalId] = useState(null);
  const [rejectedFood, setRejectedFood] = useState(null);

  const animalBoxRefs = useRef({});
  const isFeedBusyRef = useRef(false);
  const draggingFoodRef = useRef(null);
  const [draggingFood, setDraggingFood] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  const handleStartDragFood = (e, food) => {
    // 먹는 중이거나 피드백 중일 때 드래그 차단 (PROTECT)
    if (isFeedBusyRef.current) return;
    e.preventDefault();
    draggingFoodRef.current = food;
    setDraggingFood(food);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    setDragPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    if (!isFeedModalOpen) return;

    const handleWindowPointerMove = (e) => {
      if (!draggingFoodRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      setDragPos({ x, y });

      let currentOverId = null;
      Object.entries(animalBoxRefs.current).forEach(([id, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverId = id;
          }
        }
      });
      setHoverAnimalId(currentOverId);
    };

    const handleWindowPointerUp = (e) => {
      if (!draggingFoodRef.current) return;
      const food = draggingFoodRef.current;
      const x = e.clientX;
      const y = e.clientY;

      let currentOverId = null;
      Object.entries(animalBoxRefs.current).forEach(([id, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverId = id;
          }
        }
      });

      if (currentOverId && !isFeedBusyRef.current) {
        handleFeedAnimal(currentOverId, food);
      }

      draggingFoodRef.current = null;
      setDraggingFood(null);
      setHoverAnimalId(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isFeedModalOpen, feedRound]);

  // 🎨 물감 & 스탬프 & 따라쓰기 모드
  const [paintMode, setPaintMode] = useState('brush'); // 'brush' | 'stamp' | 'tracing'
  const [selectedStamp, setSelectedStamp] = useState(STAMP_ITEMS[0]);
  const [stamps, setStamps] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [brushSize, setBrushSize] = useState('medium');
  const [tracingMode, setTracingMode] = useState(null); // null = 자유그리기, template object = 따라쓰기

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const lastSoundTimeRef = useRef(0);

  // 동요 MP3 재생 관련 상태 및 Audio Ref
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [isAutoPlayNext, setIsAutoPlayNext] = useState(true); // 자동 연속 재생
  const [isShuffle, setIsShuffle] = useState(false); // 셔플 랜덤 재생
  const songAudioRef = useRef(null);

  // 풍선
  const [balloons, setBalloons] = useState(INITIAL_BALLOONS);
  const [popScore, setPopScore] = useState(0);

  useEffect(() => {
    audioEngine.muted = !soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    audioEngine.preloadItemSounds(REAL_ANIMALS);
    [...REAL_ANIMALS, ...REAL_FRUITS].forEach(item => {
      if (item.img) {
        const img = new Image();
        img.src = item.img;
      }
    });
  }, []);

  // 동요 탭 변경 시 오디오 정지 및 재생 처리
  useEffect(() => {
    if (activeTab !== 'song' && songAudioRef.current) {
      songAudioRef.current.pause();
      setIsSongPlaying(false);
    }
  }, [activeTab]);

  const playSelectedSong = (idx) => {
    setCurrentSongIdx(idx);
    const song = LOCAL_NURSERY_SONGS[idx];
    if (!song) return;

    if (songAudioRef.current) {
      songAudioRef.current.pause();
    }

    const audio = new Audio(song.url);
    audio.volume = 0.85;
    audio.play().then(() => {
      setIsSongPlaying(true);
    }).catch(() => {
      setIsSongPlaying(false);
    });

    audio.onended = () => {
      const nextIdx = (idx + 1) % LOCAL_NURSERY_SONGS.length;
      playSelectedSong(nextIdx);
    };

    songAudioRef.current = audio;
  };

  const togglePlaySong = () => {
    if (isSongPlaying && songAudioRef.current) {
      songAudioRef.current.pause();
      setIsSongPlaying(false);
    } else {
      playSelectedSong(currentSongIdx);
    }
  };

  const handleNextSong = () => {
    const nextIdx = (currentSongIdx + 1) % LOCAL_NURSERY_SONGS.length;
    playSelectedSong(nextIdx);
  };

  const handlePrevSong = () => {
    const prevIdx = (currentSongIdx - 1 + LOCAL_NURSERY_SONGS.length) % LOCAL_NURSERY_SONGS.length;
    playSelectedSong(prevIdx);
  };

  const openRealDetailModal = (item) => {
    setSelectedRealItem(item);
    setTimeout(() => {
      if (item.soundUrl) audioEngine.playItemSound(item);
    }, 0);
  };

  const closeItemModal = () => {
    audioEngine.stopAllSounds();
    setSelectedRealItem(null);
  };

  const speakQuizQuestion = (name) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const lastChar = name.charCodeAt(name.length - 1);
      const hasBatchim = (lastChar - 0xac00) % 28 > 0;
      const particle = hasBatchim ? '은' : '는';
      const text = `${name}${particle} 누구일까요?`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateQuizQuestion = () => {
    audioEngine.stopAllSounds();
    const target = REAL_ANIMALS[Math.floor(Math.random() * REAL_ANIMALS.length)];
    const others = REAL_ANIMALS.filter(i => i.id !== target.id);
    const shuffledOthers = [...others].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [target, ...shuffledOthers].sort(() => 0.5 - Math.random());
    setQuizQuestion({ target, options });
    setQuizFeedback(null);
    speakQuizQuestion(target.name);
  };

  const startQuizModal = () => {
    setIsQuizModalOpen(true);
    generateQuizQuestion();
  };

  const handleAnswerQuiz = (option) => {
    if (!quizQuestion || quizFeedback) return;
    if (option.id === quizQuestion.target.id) {
      setQuizFeedback('correct');
      audioEngine.playFanfare();
      if (quizQuestion.target.soundUrl) {
        setTimeout(() => {
          audioEngine.playItemSound(quizQuestion.target);
        }, 300);
      }
      setTimeout(() => {
        audioEngine.stopAllSounds();
        generateQuizQuestion();
      }, 3000);
    } else {
      setQuizFeedback('wrong');
      audioEngine.playFreq(200, 'sawtooth', 0.3);
      setTimeout(() => setQuizFeedback(null), 1000);
    }
  };

  // 🦁 동물 과일 먹이기 음성 안내
  const speakFeedWish = (animal, food) => {
    const targetAnimal = animal || feedRound?.target;
    const targetFood = food || feedRound?.food;
    if (!targetAnimal || !targetFood) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `${targetAnimal.name}가 ${targetFood.name} 먹고 싶어요`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.92;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const openFeedModal = () => {
    const round = pickFeedRound();
    setFeedRound(round);
    setAnimalMoods({});
    setRejectedAnimalId(null);
    setRejectedFood(null);
    isFeedBusyRef.current = false;
    setIsFeedModalOpen(true);
    speakFeedWish(round.target, round.food);
  };

  const handleFeedAnimal = (droppedAnimalId, food) => {
    if (isFeedBusyRef.current) return;
    const targetAnimal = feedRound.target;
    const wantedFood = feedRound.food;

    if (droppedAnimalId === targetAnimal.id) {
      if (food.id === wantedFood.id) {
        // 정답! 목표 동물이 원하는 과일을 줌
        isFeedBusyRef.current = true;
        audioEngine.playYum();
        setAnimalMoods({
          [targetAnimal.id]: 'eating',
          ...feedRound.threeAnimals.filter(a => a.id !== targetAnimal.id).reduce((acc, a) => ({ ...acc, [a.id]: 'happy' }), {})
        });
        setFeedScore(prev => prev + 1);

        // 1.2초 후 기뻐하기 (만세 + 하트눈 + 팡파레)
        setTimeout(() => {
          setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'happy' }));
          audioEngine.playFanfare();
        }, 1200);

        // 3.5초 후 다음 라운드 (새로운 3마리 동물 + 새 목표)
        setTimeout(() => {
          const nextRound = pickFeedRound();
          setFeedRound(nextRound);
          setAnimalMoods({});
          isFeedBusyRef.current = false;
          speakFeedWish(nextRound.target, nextRound.food);
        }, 3500);
      } else {
        // 목표 동물인데 다른 과일을 줌
        isFeedBusyRef.current = true;
        setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'reject' }));
        setRejectedAnimalId(targetAnimal.id);
        setRejectedFood(food);

        audioEngine.playFreq(200, 'sawtooth', 0.15, 0.5);
        setTimeout(() => audioEngine.playFreq(280, 'sawtooth', 0.12, 0.4), 120);
        setTimeout(() => audioEngine.playFreq(160, 'sawtooth', 0.2, 0.5), 240);

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(`이거 말고! ${targetAnimal.name}는 ${wantedFood.name} 먹고 싶어!`);
          utterance.lang = 'ko-KR';
          utterance.rate = 1.0;
          utterance.pitch = 1.2;
          window.speechSynthesis.speak(utterance);
        }

        setTimeout(() => {
          setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'hungry' }));
          setRejectedAnimalId(null);
          setRejectedFood(null);
          isFeedBusyRef.current = false;
        }, 1400);
      }
    } else {
      // 다른 동물에게 줌 (요청하지 않은 동물)
      const wrongAnimal = feedRound.threeAnimals.find(a => a.id === droppedAnimalId) || { name: '동물' };
      isFeedBusyRef.current = true;
      setAnimalMoods(prev => ({ ...prev, [droppedAnimalId]: 'reject' }));
      setRejectedAnimalId(droppedAnimalId);
      setRejectedFood(food);

      audioEngine.playFreq(200, 'sawtooth', 0.15, 0.5);
      setTimeout(() => audioEngine.playFreq(280, 'sawtooth', 0.12, 0.4), 120);
      setTimeout(() => audioEngine.playFreq(160, 'sawtooth', 0.2, 0.5), 240);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`나는 말고! ${targetAnimal.name}한테 ${wantedFood.name} 줘!`);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
      }

      setTimeout(() => {
        setAnimalMoods(prev => ({ ...prev, [droppedAnimalId]: 'hungry' }));
        setRejectedAnimalId(null);
        setRejectedFood(null);
        isFeedBusyRef.current = false;
      }, 1400);
    }
  };

  const BRUSH_SIZES = { small: { width: 6, label: '슬림 연필' }, medium: { width: 14, label: '색연필' }, large: { width: 24, label: '굵은 붓' } };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (paintMode === 'stamp') {
      const stampSizes = { small: 38, medium: 54, large: 74 };
      const newStamp = {
        id: Date.now() + Math.random(),
        x, y,
        icon: selectedStamp.icon,
        size: stampSizes[brushSize] || 54,
        rotation: Math.round((Math.random() - 0.5) * 36)
      };
      setStamps(prev => [...prev.slice(-60), newStamp]);
      audioEngine.playPopSound();
      if (selectedStamp.freq) {
        audioEngine.playXylophone(selectedStamp.freq);
      }
      return;
    }

    isDrawingRef.current = true;
    const paint = RAINBOW_PAINTS[Math.floor(Math.random() * RAINBOW_PAINTS.length)];
    audioEngine.playXylophone(paint.freq);
    lastSoundTimeRef.current = Date.now();

    const newStroke = {
      id: Date.now() + Math.random(),
      color: paint.color,
      width: BRUSH_SIZES[brushSize].width,
      points: [{ x, y }]
    };

    currentStrokeRef.current = newStroke;
    setStrokes(prev => [...prev.slice(-40), newStroke]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const stroke = currentStrokeRef.current;
    const lastPt = stroke.points[stroke.points.length - 1];

    if (lastPt) {
      const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
      if (dist < 4) return; // 미세 반응은 묶어서 매끄럽게 처리
    }

    stroke.points.push({ x, y });

    const now = Date.now();
    if (now - lastSoundTimeRef.current > 120) {
      const paint = RAINBOW_PAINTS[Math.floor(Math.random() * RAINBOW_PAINTS.length)];
      audioEngine.playXylophone(paint.freq);
      lastSoundTimeRef.current = now;
    }

    setStrokes(prev => prev.map(s => s.id === stroke.id ? { ...stroke, points: [...stroke.points] } : s));
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #fffbebf8 0%, #fef3c7 40%, #d1fae5 100%)',
      padding: isIpadFrame ? '1.5rem 1rem' : '1rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none',
      overflow: 'hidden'
    }}>
      {/* 짱구 스타일 헤더 */}
      <header style={{
        width: '100%', maxWidth: '1366px', background: '#ffffff', borderRadius: '24px',
        padding: '1rem 1.8rem', boxShadow: '0 12px 28px -6px rgba(239, 68, 68, 0.22)',
        border: '4px solid #ef4444', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#fff1f2', border: '3px solid #f87171',
            padding: '6px 12px', borderRadius: '22px', display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}>
            <img src="/shinchan_sticker.png" alt="짱구" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#dc2626', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              유나의 짱구 발달 놀이터 🖍️
            </h1>
            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#047857', background: '#d1fae5', padding: '2px 10px', borderRadius: '12px', display: 'inline-block', marginTop: '2px' }}>
              ✨ 짱구와 함께하는 신나는 놀이 세상!
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setIsIpadFrame(!isIpadFrame)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '16px',
            border: isIpadFrame ? '2.5px solid #0284c7' : '2px solid #cbd5e1',
            background: isIpadFrame ? '#e0f2fe' : '#ffffff',
            color: isIpadFrame ? '#0369a1' : '#475569', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
          }}>
            <Smartphone size={18} /> {isIpadFrame ? 'iPad 12.9" 규격뷰' : '전체화면'}
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '16px',
            border: soundEnabled ? '2.5px solid #10b981' : '2px solid #cbd5e1',
            background: soundEnabled ? '#d1fae5' : '#f1f5f9',
            color: soundEnabled ? '#047857' : '#64748b', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
          }}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {soundEnabled ? '소리 켜짐 🔊' : '음소거 🔇'}
          </button>
        </div>
      </header>

      {/* 메인 */}
      <main style={{
        width: '100%', maxWidth: isIpadFrame ? '1366px' : '100%',
        flex: 1, minHeight: 0, background: '#ffffff', borderRadius: '32px',
        border: isIpadFrame ? '6px solid #ef4444' : '2px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        {/* 탭 네비게이션 (짱구 테마 컬러) */}
        <nav style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
          padding: '14px', background: '#fff1f2', borderBottom: '3.5px solid #fca5a5'
        }}>
          {[
            { id: 'animal', label: '📸 생생 동물', sub: '울음소리 탐험', color: '#ef4444' },
            { id: 'fruit', label: '🍎 싱싱 과일/채소', sub: '고화질 실사 관찰', color: '#10b981' },
            { id: 'paint', label: '🎨 무지개 물감', sub: '터치 감각 미술', color: '#3b82f6' },
            { id: 'song', label: '🎵 동요 재생', sub: `한국 동요 (${LOCAL_NURSERY_SONGS.length}곡)`, color: '#f97316' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => {
                if (tab.id === 'animal') setAnimalItems(shuffleArray(REAL_ANIMALS));
                if (tab.id === 'fruit') setFruitItems(shuffleArray(REAL_FRUITS));
                setActiveTab(tab.id);
                audioEngine.playFreq(520, 'sine', 0.15);
              }} style={{
                padding: '14px 8px', borderRadius: '22px',
                border: isActive ? `4px solid ${tab.color}` : '2px solid #fed7aa',
                background: isActive ? tab.color : '#ffffff',
                color: isActive ? '#ffffff' : '#475569', fontWeight: 900, cursor: 'pointer',
                boxShadow: isActive ? '0 10px 22px rgba(0,0,0,0.18)' : 'none',
                transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>{tab.label}</span>
                <span style={{ fontSize: '0.8rem', opacity: isActive ? 0.95 : 0.7, fontWeight: 800 }}>{tab.sub}</span>
              </button>
            );
          })}
        </nav>

        {/* 캔버스 영역 */}
        <div style={{ flex: 1, padding: activeTab === 'paint' ? '1rem 1.8rem' : '1.8rem', position: 'relative', background: '#fafafa', overflowY: activeTab === 'paint' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* ===== 모듈 1: 20종 동물 실사 ===== */}
          {activeTab === 'animal' && (
            <div>
              <div style={{
                background: '#ffedd5', borderRadius: '24px', padding: '1.2rem 1.6rem', marginBottom: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '2.5px solid #fed7aa', flexWrap: 'wrap', gap: '14px'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9a3412', margin: 0 }}>
                  📸 카드를 누르면 진짜 동물 울음소리가 들려요!
                </h2>
                <button onClick={startQuizModal} style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff',
                  border: 'none', padding: '12px 24px', borderRadius: '18px', fontWeight: 900,
                  fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(239,68,68,0.35)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={22} /> 🎯 동물 퀴즈!
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                {animalItems.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `3.5px solid ${item.color}`, borderRadius: '22px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.07)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '155px', overflow: 'hidden', background: '#f8fafc' }}>
                      <img
                        src={item.img}
                        alt={item.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          if (item.id === 'duck') e.target.src = 'https://images.pexels.com/photos/2695703/pexels-photo-2695703.jpeg?auto=compress&cs=tinysrgb&w=800';
                        }}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          objectPosition: item.fitPos || 'center 20%'
                        }}
                      />
                    </div>
                    <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', margin: '0 0 5px 0' }}>{item.name}</h3>
                      {item.soundUrl ? (
                        <span style={{
                          background: item.color, color: '#ffffff', fontSize: '0.8rem', fontWeight: 900,
                          padding: '3px 10px', borderRadius: '12px', display: 'inline-block'
                        }}>🔊 {item.soundText}</span>
                      ) : (
                        <span style={{
                          background: '#94a3b8', color: '#ffffff', fontSize: '0.8rem', fontWeight: 900,
                          padding: '3px 10px', borderRadius: '12px', display: 'inline-block'
                        }}>🔇 소리 준비 중</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 2: 🍎 18종 싱싱 과일 & 채소 관찰 ===== */}
          {activeTab === 'fruit' && (
            <div>
              <div style={{
                background: '#fee2e2', borderRadius: '24px', padding: '1.2rem 1.6rem', marginBottom: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '2.5px solid #fecdd3', flexWrap: 'wrap', gap: '14px'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9f1239', margin: 0 }}>
                  🍎 싱싱한 과일·채소 카드를 콕콕 눌러보세요! 커다란 고화질 사진이 보여요!
                </h2>
                <button onClick={openFeedModal} style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff',
                  border: 'none', padding: '12px 24px', borderRadius: '18px', fontWeight: 900,
                  fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={22} /> 🦁 동물 친구들 과일 먹이기!
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.9rem' }}>
                {fruitItems.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `3.5px solid ${item.color}`, borderRadius: '20px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '135px', overflow: 'hidden', background: '#f8fafc', padding: item.objectFit === 'contain' ? '8px' : '0' }}>
                      <img
                        src={item.img}
                        alt={item.name}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: item.objectFit || 'cover',
                          objectPosition: item.fitPos || 'center center'
                        }}
                      />
                    </div>
                    <div style={{ padding: '0.65rem 0.4rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{item.icon} {item.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 3: 무지개 물감 & 퐁퐁 스탬프 & 따라쓰기 ===== */}
          {activeTab === 'paint' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* 상단 툴바 */}
              <div style={{
                background: '#e0f2fe', border: '2.5px solid #bae6fd', borderRadius: '20px',
                padding: '0.7rem 1.2rem', marginBottom: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                flexShrink: 0
              }}>
                {/* 모드 선택 (물감 / 퐁퐁 스탬프 / 따라쓰기) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setPaintMode('brush'); setTracingMode(null); }} style={{
                    background: paintMode === 'brush' ? '#3b82f6' : '#ffffff',
                    color: paintMode === 'brush' ? '#ffffff' : '#0369a1',
                    border: paintMode === 'brush' ? '3px solid #1d4ed8' : '2px solid #bae6fd',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    🎨 물감 그리기
                  </button>

                  <button onClick={() => { setPaintMode('stamp'); setTracingMode(null); }} style={{
                    background: paintMode === 'stamp' ? '#ec4899' : '#ffffff',
                    color: paintMode === 'stamp' ? '#ffffff' : '#be185d',
                    border: paintMode === 'stamp' ? '3px solid #db2777' : '2px solid #fbcfe8',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    🐾 퐁퐁 스탬프
                  </button>

                  <button onClick={() => {
                    setPaintMode('tracing');
                    if (!tracingMode) setTracingMode(TRACING_TEMPLATES[0]);
                    setStrokes([]);
                  }} style={{
                    background: paintMode === 'tracing' ? '#f59e0b' : '#ffffff',
                    color: paintMode === 'tracing' ? '#ffffff' : '#92400e',
                    border: paintMode === 'tracing' ? '3px solid #d97706' : '2px solid #fcd34d',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    ✏️ 따라쓰기
                  </button>
                </div>

                {/* 우측 조작 (크기 선택 & 지우기) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 크기 선택 */}
                  {[{ key: 'small', label: '작게', sz: 14 }, { key: 'medium', label: '보통', sz: 20 }, { key: 'large', label: '크게', sz: 28 }].map(b => (
                    <button key={b.key} onClick={() => setBrushSize(b.key)} style={{
                      background: brushSize === b.key ? '#0284c7' : '#ffffff',
                      color: brushSize === b.key ? '#ffffff' : '#334155',
                      border: brushSize === b.key ? '3px solid #0369a1' : '2px solid #cbd5e1',
                      borderRadius: '14px', padding: '5px 10px', fontWeight: 900, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem'
                    }}>
                      <span style={{ width: b.sz, height: b.sz, borderRadius: '50%', background: brushSize === b.key ? '#7dd3fc' : '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                      {b.label}
                    </button>
                  ))}

                  <span style={{ width: '2px', height: '26px', background: '#bae6fd', borderRadius: '2px' }} />

                  <button onClick={() => { setStrokes([]); setStamps([]); }} style={{
                    background: '#ef4444', color: '#ffffff', border: 'none', padding: '7px 14px',
                    borderRadius: '14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.86rem',
                    boxShadow: '0 3px 10px rgba(239,68,68,0.25)'
                  }}><Eraser size={16} /> 싹 지우기</button>
                </div>
              </div>

              {/* 🐾 스탬프 선택 바 (퐁퐁 스탬프 모드일 때) */}
              {paintMode === 'stamp' && (
                <div style={{
                  display: 'flex', gap: '8px', marginBottom: '0.6rem', flexWrap: 'wrap',
                  flexShrink: 0, alignItems: 'center', background: '#fdf2f8', padding: '8px 14px',
                  borderRadius: '16px', border: '2px solid #fbcfe8'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#be185d', marginRight: '4px' }}>도장 선택:</span>
                  {STAMP_ITEMS.map(st => (
                    <button key={st.id} onClick={() => setSelectedStamp(st)} style={{
                      padding: '5px 12px', borderRadius: '14px',
                      background: selectedStamp.id === st.id ? '#f472b6' : '#ffffff',
                      border: selectedStamp.id === st.id ? '3px solid #db2777' : '2px solid #fbcfe8',
                      fontSize: '1.25rem', fontWeight: 900,
                      color: selectedStamp.id === st.id ? '#ffffff' : '#9d174d',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      transform: selectedStamp.id === st.id ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}>
                      <span>{st.icon}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 900 }}>{st.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ✏️ 따라쓰기 글자 선택 (따라쓰기 모드일 때) */}
              {paintMode === 'tracing' && tracingMode && (
                <div style={{
                  display: 'flex', gap: '6px', marginBottom: '0.6rem', flexWrap: 'wrap',
                  flexShrink: 0, alignItems: 'center', background: '#fffbeb', padding: '8px 14px',
                  borderRadius: '16px', border: '2px solid #fde68a'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#92400e', marginRight: '4px' }}>숫자 선택:</span>
                  {TRACING_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setTracingMode(t); setStrokes([]); }} style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: tracingMode.id === t.id ? '#fbbf24' : '#ffffff',
                      border: tracingMode.id === t.id ? '3px solid #d97706' : '2px solid #fcd34d',
                      fontSize: '1.2rem', fontWeight: 900,
                      color: tracingMode.id === t.id ? '#78350f' : '#92400e',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{t.label}</button>
                  ))}
                </div>
              )}

              {/* 캔버스 (flex: 1로 남은 공간 전부 사용, 연필 stroke & 스탬프 드로잉) */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={paintMode !== 'stamp' ? handlePointerMove : undefined}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  width: '100%', flex: 1, minHeight: 0, background: '#ffffff', borderRadius: '24px',
                  border: paintMode === 'stamp' ? '4px dashed #f472b6' : '4px dashed #38bdf8',
                  position: 'relative', overflow: 'hidden',
                  cursor: paintMode === 'stamp' ? 'pointer' : 'crosshair',
                  touchAction: 'none'
                }}
              >
                {/* 따라쓰기 가이드 실선 (배경) */}
                {paintMode === 'tracing' && tracingMode && (
                  <svg viewBox={tracingMode.viewBox} style={{
                    position: 'absolute', inset: '8%', width: '84%', height: '84%',
                    pointerEvents: 'none', opacity: 0.35
                  }}>
                    {tracingMode.paths.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="12"
                        strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                  </svg>
                )}

                {/* 찍힌 스탬프들 */}
                {stamps.map(st => (
                  <div
                    key={st.id}
                    className="stamp-pop"
                    style={{
                      position: 'absolute',
                      left: st.x,
                      top: st.y,
                      transform: `translate(-50%, -50%) rotate(${st.rotation || 0}deg)`,
                      fontSize: `${st.size}px`,
                      lineHeight: 1,
                      pointerEvents: 'none',
                      zIndex: 3,
                      userSelect: 'none'
                    }}
                  >
                    {st.icon}
                  </div>
                ))}

                {/* 사용자가 그린 연필 브러시 스트로크 선 (SVG Vector Lines) */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                  {strokes.map(s => {
                    if (!s.points || s.points.length === 0) return null;
                    const d = s.points.length === 1
                      ? `M ${s.points[0].x} ${s.points[0].y} L ${s.points[0].x + 0.1} ${s.points[0].y + 0.1}`
                      : s.points.reduce((acc, p, idx) => acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');

                    return (
                      <path
                        key={s.id}
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={s.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.9 }}
                      />
                    );
                  })}
                </svg>

                {strokes.length === 0 && stamps.length === 0 && paintMode === 'brush' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8', pointerEvents: 'none'
                  }}>
                    <Sparkles size={56} style={{ color: '#38bdf8', marginBottom: '12px' }} />
                    <p style={{ fontSize: '1.4rem', fontWeight: 900 }}>화면에 연필처럼 쓱쓱 자유롭게 그려보세요!</p>
                  </div>
                )}
                {strokes.length === 0 && stamps.length === 0 && paintMode === 'stamp' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#f472b6', pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: '3rem', marginBottom: '8px' }}>🐾</span>
                    <p style={{ fontSize: '1.35rem', fontWeight: 900 }}>화면을 콕콕 터치하여 귀여운 도장을 퐁퐁 찍어보세요!</p>
                  </div>
                )}
                {strokes.length === 0 && paintMode === 'tracing' && tracingMode && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#92400e', pointerEvents: 'none'
                  }}>
                    <p style={{ fontSize: '1.3rem', fontWeight: 900, opacity: 0.6 }}>✏️ 점선을 따라 연필처럼 쓱쓱 그려보세요!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 모듈 4: 🎵 한국 동요 MP3 플레이어 ===== */}
          {activeTab === 'song' && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{
                background: '#dcfce7', border: '2.5px solid #86efac', borderRadius: '20px',
                padding: '0.6rem 1.4rem', display: 'inline-flex', alignItems: 'center', gap: '16px', marginBottom: '1rem',
                fontSize: '1.05rem', fontWeight: 900, color: '#166534', flexWrap: 'wrap', justifyContent: 'center'
              }}>
                <span>🎵 유나와 함께 들어요! 총 {LOCAL_NURSERY_SONGS.length}곡의 신나는 동요 🎶</span>

                {/* 연속 / 셔플 자동 재생 토글 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setIsAutoPlayNext(!isAutoPlayNext)} style={{
                    background: isAutoPlayNext ? '#16a34a' : '#ffffff',
                    color: isAutoPlayNext ? '#ffffff' : '#475569',
                    border: isAutoPlayNext ? '2px solid #15803d' : '2px solid #cbd5e1',
                    borderRadius: '14px', padding: '5px 12px', fontWeight: 900, cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}>
                    🔂 연속 재생 {isAutoPlayNext ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => setIsShuffle(!isShuffle)} style={{
                    background: isShuffle ? '#9333ea' : '#ffffff',
                    color: isShuffle ? '#ffffff' : '#475569',
                    border: isShuffle ? '2px solid #7e22ce' : '2px solid #cbd5e1',
                    borderRadius: '14px', padding: '5px 12px', fontWeight: 900, cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}>
                    🔀 셔플 {isShuffle ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* 가로 슬림 콤팩트 MP3 플레이어 컨트롤러 */}
              <div style={{
                maxWidth: '780px', margin: '0 auto 1rem auto', background: '#ffffff',
                borderRadius: '24px', border: '4px solid #16a34a', padding: '1rem 1.6rem',
                boxShadow: '0 10px 24px rgba(22, 163, 74, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
              }}>
                <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '2.8rem', lineHeight: 1 }}>
                    {isSongPlaying ? '🎵💃🎶' : '📻'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {LOCAL_NURSERY_SONGS[currentSongIdx]?.title || '동요 선택'}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 700, margin: '2px 0 0 0' }}>
                      {currentSongIdx + 1} / {LOCAL_NURSERY_SONGS.length} 곡 {isShuffle ? '(셔플 모드)' : ''}
                    </p>
                  </div>
                </div>

                {/* 컨트롤 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={handlePrevSong} style={{
                    background: '#f1f5f9', color: '#1e293b', border: 'none', borderRadius: '18px',
                    padding: '10px 16px', fontSize: '0.98rem', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}><SkipBack size={20} /> 이전곡</button>

                  <button onClick={togglePlaySong} style={{
                    background: isSongPlaying ? '#ef4444' : '#16a34a', color: '#ffffff', border: 'none',
                    borderRadius: '22px', padding: '12px 28px', fontSize: '1.15rem', fontWeight: 900,
                    cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    {isSongPlaying ? <Pause size={24} /> : <Play size={24} />}
                    {isSongPlaying ? '일시정지' : '노래 시작'}
                  </button>

                  <button onClick={handleNextSong} style={{
                    background: '#f1f5f9', color: '#1e293b', border: 'none', borderRadius: '18px',
                    padding: '10px 16px', fontSize: '0.98rem', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>다음곡 <SkipForward size={20} /></button>
                </div>
              </div>

              {/* 85곡 동요 목록 넓은 그리드 (maxHeight 600px로 대폭 확장) */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.8rem', maxWidth: '1060px', margin: '0 auto', maxHeight: '600px', overflowY: 'auto',
                padding: '14px', background: '#f8fafc', borderRadius: '24px', border: '2px solid #e2e8f0'
              }}>
                {LOCAL_NURSERY_SONGS.map((song, idx) => (
                  <div key={song.id} onClick={() => playSelectedSong(idx)} style={{
                    background: currentSongIdx === idx ? '#dcfce7' : '#ffffff',
                    border: currentSongIdx === idx ? '3px solid #16a34a' : '2px solid #e2e8f0',
                    borderRadius: '18px', padding: '12px 14px', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
                  }}>
                    <span style={{
                      background: currentSongIdx === idx ? '#16a34a' : '#f1f5f9',
                      color: currentSongIdx === idx ? '#ffffff' : '#64748b',
                      borderRadius: '50%', width: '28px', height: '28px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900,
                      flexShrink: 0
                    }}>{idx + 1}</span>
                    <span style={{
                      fontSize: '0.98rem', fontWeight: 800,
                      color: currentSongIdx === idx ? '#15803d' : '#334155',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>{song.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== 동물 & 과일 관찰 대형 팝업 모달 ===== */}
      {selectedRealItem && (
        <div onClick={closeItemModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999, padding: '1.5rem', cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: '36px', maxWidth: '620px', width: '100%',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: `6px solid ${selectedRealItem.color}`, position: 'relative', cursor: 'default'
          }}>
            <button onClick={closeItemModal} style={{
              position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.6)',
              color: '#ffffff', border: 'none', borderRadius: '50%', width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
            }}><X size={26} /></button>

            <div style={{
              width: '100%', height: '360px', overflow: 'hidden', background: '#f1f5f9',
              padding: selectedRealItem.objectFit === 'contain' ? '16px' : '0'
            }}>
              <img src={selectedRealItem.img} alt={selectedRealItem.name} style={{
                width: '100%', height: '100%',
                objectFit: selectedRealItem.objectFit || 'cover',
                objectPosition: selectedRealItem.fitPos || 'center center'
              }} />
            </div>

            <div style={{ padding: '2rem', textAlign: 'center', background: selectedRealItem.bg }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', margin: selectedRealItem.soundUrl ? '0 0 14px 0' : '0' }}>
                {selectedRealItem.icon ? `${selectedRealItem.icon} ` : ''}{selectedRealItem.name}
              </h2>
              {selectedRealItem.soundUrl && (
                <button onClick={() => audioEngine.playItemSound(selectedRealItem)} style={{
                  background: selectedRealItem.color, color: '#ffffff', border: 'none',
                  padding: '14px 28px', borderRadius: '22px', fontSize: '1.3rem', fontWeight: 900,
                  cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  display: 'inline-flex', alignItems: 'center', gap: '10px'
                }}>
                  <Volume2 size={26} /> 울음소리 다시 듣기 🔊
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 퀴즈 모달 ===== */}
      {isQuizModalOpen && quizQuestion && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '36px', maxWidth: '850px', width: '100%',
            padding: '2.2rem', border: '6px solid #ef4444',
            boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)', position: 'relative'
          }}>
            <button onClick={() => { setIsQuizModalOpen(false); audioEngine.stopAllSounds(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }} style={{
              position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: '50%', width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}><X size={26} /></button>

            <div style={{
              background: '#fff1f2', border: '3.5px solid #fecdd3', borderRadius: '24px',
              padding: '1.4rem', textAlign: 'center', marginBottom: '1.8rem'
            }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#9f1239', margin: '0 0 10px 0' }}>
                ❓ {quizQuestion.target.name}는(은) 누구일까요?
              </h2>
              <button onClick={() => speakQuizQuestion(quizQuestion.target.name)} style={{
                background: '#be123c', color: '#ffffff', border: 'none', padding: '10px 22px',
                borderRadius: '16px', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(190, 18, 60, 0.25)'
              }}><Volume2 size={22} /> 🔊 음성 다시 듣기</button>
            </div>

            {quizFeedback === 'correct' && (
              <div style={{
                background: '#dcfce7', border: '3.5px solid #22c55e', borderRadius: '20px',
                padding: '1rem', textAlign: 'center', marginBottom: '1.2rem',
                fontSize: '1.4rem', fontWeight: 900, color: '#15803d'
              }}>🎉 정답이에요!! 참 잘했어요! 🌟</div>
            )}
            {quizFeedback === 'wrong' && (
              <div style={{
                background: '#fee2e2', border: '3.5px solid #ef4444', borderRadius: '20px',
                padding: '1rem', textAlign: 'center', marginBottom: '1.2rem',
                fontSize: '1.3rem', fontWeight: 900, color: '#991b1b'
              }}>😮 다시 한번 찾아볼까요? 화이팅! 💪</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
              {quizQuestion.options.map(opt => (
                <div key={opt.id} onClick={() => handleAnswerQuiz(opt)} style={{
                  background: '#ffffff', border: '4px solid #cbd5e1', borderRadius: '24px',
                  overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                }}>
                  <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}>
                    <img src={opt.img} alt={opt.name} style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      objectPosition: opt.fitPos || 'center 20%'
                    }} />
                  </div>
                  <div style={{ padding: '0.9rem', textAlign: 'center', fontWeight: 900, fontSize: '1.15rem', color: '#1e293b' }}>
                    {opt.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 🦁 3마리 동물 과일 먹이기 놀이 모달 (드래그 앤 드롭 지원) ===== */}
      {isFeedModalOpen && feedRound && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: '1rem', userSelect: 'none'
          }}
        >
          <div style={{
            background: '#fffbeb', borderRadius: '36px', maxWidth: '860px', width: '100%',
            padding: '1.8rem 1.6rem', border: '6px solid #f59e0b',
            boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.35)', position: 'relative', textAlign: 'center'
          }}>
            <button onClick={() => { setIsFeedModalOpen(false); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }} style={{
              position: 'absolute', top: '18px', right: '18px', background: '#fef3c7', color: '#78350f',
              border: '2px solid #fde68a', borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
            }}><X size={24} /></button>

            {/* 상단 점수 */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fef3c7', padding: '6px 18px', borderRadius: '20px', marginBottom: '0.8rem', border: '2px solid #fde68a' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#92400e' }}>⭐ 먹인 과일: {feedScore}개</span>
            </div>

            {/* 목표 동물 말풍선 */}
            <div
              onClick={() => speakFeedWish(feedRound.target, feedRound.food)}
              title="콕 누르면 동물 친구가 목소리로 다시 말해요!"
              style={{
                background: '#ffffff', border: '3.5px solid #fbbf24', borderRadius: '24px',
                padding: '0.9rem 1.4rem', marginBottom: '1.2rem', boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                cursor: 'pointer', position: 'relative', display: 'inline-block', maxWidth: '90%'
              }}
            >
              <p style={{ fontSize: '1.35rem', fontWeight: 900, color: '#78350f', margin: 0 }}>
                {rejectedAnimalId === feedRound.target.id
                  ? `😤 "${feedRound.target.name}: 이거 말고~!! ${feedRound.food.name} 달라고~! 😣"`
                  : rejectedAnimalId
                    ? `🙅 "${feedRound.threeAnimals.find(a => a.id === rejectedAnimalId)?.name || '나'} 말고! ${feedRound.target.name}한테 ${feedRound.food.name} 줘! 😣"`
                    : animalMoods[feedRound.target.id] === 'eating'
                      ? `😋 "${feedRound.target.name}: 아구아구... 우물우물... 냠냠!"`
                      : animalMoods[feedRound.target.id] === 'happy'
                        ? `💖 "${feedRound.target.name}: 너무 맛있다~! 최고야! 🥰"`
                        : hoverAnimalId === feedRound.target.id
                          ? `😮 "${feedRound.target.name}: 아~~ 입 벌리고 있어! 쏙 넣어줘!"`
                          : `"${feedRound.target.name}가 ${feedRound.food.name} 먹고 싶어요! ${feedRound.food.icon}"`}
              </p>
              {/* 말풍선 꼬리 */}
              <div style={{
                position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                borderTop: '10px solid #fbbf24'
              }} />
              <div style={{
                position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
                borderTop: '8px solid #ffffff'
              }} />
            </div>

            {/* 3마리 동물 캐릭터 드롭 영역 목록 */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
              marginBottom: '1rem', alignItems: 'stretch'
            }}>
              {feedRound.threeAnimals.map(animal => {
                const isTarget = animal.id === feedRound.target.id;
                const isOver = hoverAnimalId === animal.id;
                const mood = animalMoods[animal.id] || 'hungry';

                return (
                  <div
                    key={animal.id}
                    ref={el => { animalBoxRefs.current[animal.id] = el; }}
                    onClick={() => {
                      if (isTarget) speakFeedWish(animal, feedRound.food);
                    }}
                    style={{
                      padding: '10px 8px', borderRadius: '26px',
                      border: isOver
                        ? '4px dashed #f59e0b'
                        : isTarget
                          ? '3.5px solid #f59e0b'
                          : '2.5px solid #fed7aa',
                      background: isOver
                        ? '#fef3c7'
                        : isTarget
                          ? '#ffffff'
                          : '#fffbf0',
                      boxShadow: isTarget ? '0 8px 22px rgba(245, 158, 11, 0.15)' : '0 4px 12px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    {/* 이름 및 목표 라벨 */}
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{
                        background: isTarget ? '#f59e0b' : '#94a3b8',
                        color: '#ffffff', padding: '4px 12px', borderRadius: '14px',
                        fontWeight: 900, fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        {animal.icon} {animal.name} {isTarget ? '🙋 (원해요!)' : ''}
                      </span>
                    </div>

                    {/* SVG 애니메이션 캐릭터 */}
                    <AnimatedAnimalCharacter
                      animal={animal}
                      mood={mood}
                      isOver={isOver}
                      rejectedFoodIcon={rejectedAnimalId === animal.id ? rejectedFood?.icon : null}
                      isTarget={isTarget}
                    />
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: '1.05rem', fontWeight: 900, color: '#92400e', marginBottom: '0.8rem' }}>
              👇 원하는 과일·채소를 손가락으로 끌어다(Drag) <strong>{feedRound.target.name}</strong>에게 쏙 넣어주세요!
            </p>

            {/* 과일/채소 랜덤 5개 선택 카드 (먹는 동안 PROTECT 비활성화) */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px',
              opacity: isFeedBusyRef.current ? 0.45 : 1,
              pointerEvents: isFeedBusyRef.current ? 'none' : 'auto',
              transition: 'opacity 0.25s ease'
            }}>
              {feedRound.choices.map(food => (
                <button
                  key={food.id}
                  onPointerDown={(e) => handleStartDragFood(e, food)}
                  style={{
                    background: '#ffffff',
                    border: '2.5px solid #fed7aa',
                    borderRadius: '20px', padding: '12px 8px',
                    cursor: isFeedBusyRef.current ? 'not-allowed' : 'grab',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)', touchAction: 'none',
                    opacity: draggingFood?.id === food.id ? 0.25 : 1,
                    userSelect: 'none'
                  }}
                >
                  <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{food.icon}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{food.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 손가락/마우스를 따라 움직이는 드래그 과일 이펙트 */}
          {draggingFood && (
            <div style={{
              position: 'fixed', left: dragPos.x, top: dragPos.y,
              transform: 'translate(-50%, -50%) scale(1.3)',
              zIndex: 2000, pointerEvents: 'none', fontSize: '4.5rem',
              filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.35))'
            }}>
              {draggingFood.icon}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
