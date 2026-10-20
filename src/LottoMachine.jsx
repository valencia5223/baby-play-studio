// 🎰 로또 탭의 캡슐 뽑기 기계
// 유리 돔 안의 공 45개는 캔버스 물리(중력·충돌·돔 벽)로 움직이고, 레버를 돌리면 소용돌이 바람으로 섞인다.
// 뽑힌 번호(removed)는 돔 아래 출구로 빠져나가 사라지고, 처음부터 하면 위에서 다시 떨어져 채워진다.
// 본체(빨간 금속·크롬 손잡이·배출구)와 캡슐은 CSS (LottoGacha.css 의 .lg-gm-*)
import { useEffect, useRef } from 'react';

const SIZE = 264; // 캔버스 한 변(CSS px)
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 10; // 돔 안쪽 반지름
const BR = 12.5; // 공 반지름
const GRAVITY = 0.32;
const SUBSTEPS = 3;

const COLORS = (n) => (n <= 10 ? ['#ffe066', '#fbc400', '#b98a00']
  : n <= 20 ? ['#a5e3ff', '#4fb8ea', '#1f7fae']
    : n <= 30 ? ['#ffb3b3', '#ff6161', '#c42d2d']
      : n <= 40 ? ['#e2e2e2', '#a3a3a3', '#5f5f5f']
        : ['#dcf59a', '#9fcf2c', '#5d8a0c']);

// 번호 공 그림을 미리 한 번 그려 둠 (매 프레임 그라데이션을 새로 만들지 않게)
const spriteCache = new Map();
const ballSprite = (n, dpr) => {
  const key = `${n}@${dpr}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const s = Math.ceil(BR * 2 * dpr) + 2;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const r = BR;
  const o = 1 / dpr + r;
  const [hi, base, dark] = COLORS(n);
  const grad = g.createRadialGradient(o - r * 0.4, o - r * 0.45, r * 0.1, o, o, r);
  grad.addColorStop(0, hi);
  grad.addColorStop(0.45, base);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(o, o, r, 0, Math.PI * 2);
  g.fill();
  // 번호 띠(흰 원)
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.arc(o + 0.5, o + 0.8, r * 0.52, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#27272a';
  g.font = `800 ${n >= 10 ? 8.6 : 9.5}px Pretendard, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), o + 0.5, o + 1.3);
  // 반짝임
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(o - r * 0.42, o - r * 0.5, r * 0.28, r * 0.17, -0.7, 0, Math.PI * 2);
  g.fill();
  spriteCache.set(key, c);
  return c;
};

const newBall = (n, x, y) => ({ n, x, y, vx: (Math.random() - 0.5) * 2, vy: 0, leaving: 0 });

// 돔 아래쪽에 겹치지 않게 쌓아 둔 시작 배치
const initialBalls = (exclude) => {
  const list = [];
  const nums = [];
  for (let n = 1; n <= 45; n++) if (!exclude.has(n)) nums.push(n);
  // 무작위 순서로 섞어 색이 고루 섞이게
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  let row = 0;
  let k = 0;
  while (k < nums.length) {
    const y = CY + R - BR - 1 - row * BR * 1.75;
    const half = Math.sqrt(Math.max(0, (R - BR) ** 2 - (y - CY) ** 2));
    const count = Math.max(1, Math.floor((half * 2) / (BR * 2.05)));
    const startX = CX - ((count - 1) * BR * 2.05) / 2 + (row % 2 ? BR * 0.5 : 0);
    for (let i = 0; i < count && k < nums.length; i++, k++) {
      list.push(newBall(nums[k], startX + i * BR * 2.05, y));
    }
    row++;
  }
  return list;
};

const step = (balls, stir) => {
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const b of balls) {
      if (b.leaving) continue;
      b.vy += GRAVITY / SUBSTEPS;
      if (stir) {
        // 소용돌이(돔 가운데를 도는 힘) + 아래쪽 공을 위로 불어 올리는 바람
        const dx = b.x - CX;
        const dy = b.y - CY;
        const d = Math.hypot(dx, dy) || 1;
        b.vx += (-dy / d) * 0.5 / SUBSTEPS;
        b.vy += (dx / d) * 0.5 / SUBSTEPS;
        if (b.y > CY + R * 0.15 && Math.random() < 0.14 / SUBSTEPS) {
          b.vy -= 7 + Math.random() * 7;
          b.vx += (Math.random() - 0.5) * 8;
        }
      }
      b.vx *= 0.998;
      b.vy *= 0.998;
      b.x += b.vx / SUBSTEPS;
      b.y += b.vy / SUBSTEPS;
      // 돔 벽
      const dx = b.x - CX;
      const dy = b.y - CY;
      const d = Math.hypot(dx, dy);
      const max = R - BR;
      if (d > max) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = CX + nx * max;
        b.y = CY + ny * max;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= 1.5 * vn * nx;
          b.vy -= 1.5 * vn * ny;
          b.vx *= 0.97;
          b.vy *= 0.97;
        }
      }
    }
    // 공끼리 부딪힘
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.leaving) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.leaving) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = BR * 2;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -rel * 0.8; // 탄성 (1 이면 완전 탄성)
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;
        }
      }
    }
  }
};

const drawGlass = (g) => {
  // 유리 안쪽 은은한 색
  const tint = g.createRadialGradient(CX - R * 0.3, CY - R * 0.35, R * 0.1, CX, CY, R);
  tint.addColorStop(0, 'rgba(255,255,255,0.10)');
  tint.addColorStop(0.75, 'rgba(210,225,255,0.06)');
  tint.addColorStop(1, 'rgba(120,150,210,0.28)');
  g.fillStyle = tint;
  g.beginPath();
  g.arc(CX, CY, R, 0, Math.PI * 2);
  g.fill();
  // 큰 반사광 (왼쪽 위 곡면)
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(CX, CY, R - 14, Math.PI * 1.08, Math.PI * 1.42);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(CX, CY, R - 14, Math.PI * 1.48, Math.PI * 1.56);
  g.stroke();
  // 오른쪽 아래 반사
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(CX, CY, R - 10, Math.PI * 0.12, Math.PI * 0.32);
  g.stroke();
  // 작은 하이라이트 점
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(CX - R * 0.38, CY - R * 0.62, 7, 4, -0.6, 0, Math.PI * 2);
  g.fill();
  // 유리 테두리 (두께감)
  const rim = g.createLinearGradient(0, CY - R, 0, CY + R);
  rim.addColorStop(0, 'rgba(255,255,255,0.9)');
  rim.addColorStop(0.5, 'rgba(170,190,220,0.6)');
  rim.addColorStop(1, 'rgba(90,110,150,0.8)');
  g.strokeStyle = rim;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(CX, CY, R + 1, 0, Math.PI * 2);
  g.stroke();
};

function Globe({ spinning, removed }) {
  const canvasRef = useRef(null);
  const ballsRef = useRef(null);
  const spinRef = useRef(spinning);
  const wakeRef = useRef(() => {});
  spinRef.current = spinning;

  // 처음: 공 배치 + 그리기 루프 (움직임이 멈추면 쉬었다가 바뀌면 다시)
  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const g = canvas.getContext('2d');
    if (!ballsRef.current) ballsRef.current = initialBalls(new Set(removed));
    let raf = 0;
    let calm = 0;
    let running = false;

    const frame = () => {
      const balls = ballsRef.current;
      step(balls, spinRef.current);
      // 출구로 빠져나가는 공
      for (const b of balls) {
        if (!b.leaving) continue;
        b.leaving += 1;
        b.x += (CX - b.x) * 0.18;
        b.y += (CY + R + BR * 2 - b.y) * 0.16;
      }
      ballsRef.current = balls.filter(b => b.leaving < 22);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);
      // 돔 안 그림자 바닥
      const floor = g.createRadialGradient(CX, CY + R * 0.85, 4, CX, CY + R * 0.85, R * 0.8);
      floor.addColorStop(0, 'rgba(30,40,70,0.22)');
      floor.addColorStop(1, 'rgba(30,40,70,0)');
      g.fillStyle = floor;
      g.beginPath();
      g.arc(CX, CY, R, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(CX, CY, R, 0, Math.PI * 2);
      g.clip();
      // 아래쪽 공부터 그려 위 공이 앞에 오게
      const sorted = [...ballsRef.current].sort((a, b) => a.y - b.y);
      for (const b of sorted) {
        const scale = b.leaving ? Math.max(0.2, 1 - b.leaving / 22) : 1;
        const sp = ballSprite(b.n, dpr);
        const w = (sp.width / dpr) * scale;
        g.drawImage(sp, b.x - w / 2, b.y - w / 2, w, w);
      }
      g.restore();
      drawGlass(g);

      const moving = ballsRef.current.some(b => b.leaving || Math.abs(b.vx) + Math.abs(b.vy) > 0.08);
      calm = spinRef.current || moving ? 0 : calm + 1;
      if (calm > 40) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (running) return;
      running = true;
      calm = 0;
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;
    wake();
    return () => {
      cancelAnimationFrame(raf);
      running = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (spinning) wakeRef.current();
  }, [spinning]);

  // 뽑힌 공은 출구로, 처음부터 하면 빠진 공을 위에서 다시 떨어뜨림
  const removedKey = removed.join(',');
  useEffect(() => {
    const balls = ballsRef.current;
    if (!balls) return;
    const gone = new Set(removed);
    balls.forEach(b => {
      if (gone.has(b.n) && !b.leaving) b.leaving = 1;
    });
    const have = new Set(balls.map(b => b.n));
    for (let n = 1; n <= 45; n++) {
      if (!gone.has(n) && !have.has(n)) {
        balls.push(newBall(n, CX + (Math.random() - 0.5) * R, CY - R * 0.55 - Math.random() * 20));
      }
    }
    wakeRef.current();
  }, [removedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="lg-gm-globe" style={{ width: SIZE, height: SIZE }} />;
}

// 배출구에 나온 공: 돔 안 공과 같은 그림을 크게
function BigBall({ n, size = 58 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = size / (BR * 2);
    const sp = ballSprite(n, dpr * scale);
    c.width = sp.width;
    c.height = sp.height;
    c.getContext('2d').drawImage(sp, 0, 0);
  }, [n, size]);
  return <canvas ref={ref} className="lg-gm-bigball lg-pop" style={{ width: size + 2, height: size + 2 }} aria-label={`${n}번`} />;
}

export default function LottoMachine({ spinning, dropping, current, onSpin, disabled, label, removed }) {
  return (
    <div className={`lg-gm ${spinning ? 'is-spinning' : ''}`}>
      <div className="lg-gm-top">
        <Globe spinning={spinning} removed={removed} />
        <div className="lg-gm-collar" />
      </div>
      <div className="lg-gm-body">
        <div className="lg-gm-plate">LOTTO <b>6/45</b></div>
        <div className="lg-gm-coin" aria-hidden="true"><span /></div>
        <button type="button" className="lg-gm-knob" onClick={onSpin} disabled={disabled} aria-label={label}>
          <span className="lg-gm-knob-grip" />
          <span className="lg-gm-knob-bar" />
        </button>
        <div className="lg-gm-outlet">
          {current && (
            <div className={`lg-gm-capsule ${dropping ? 'is-dropping' : 'is-open'}`}>
              <span className="lg-gm-cap-top" />
              <span className="lg-gm-cap-bottom" />
              {!dropping && <BigBall n={current} />}
            </div>
          )}
          <span className="lg-gm-flap" />
        </div>
        <div className="lg-gm-feet"><span /><span /></div>
      </div>
      <button type="button" className="lg-spin-btn" onClick={onSpin} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}
