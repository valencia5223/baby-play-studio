// ✨ 무지개 물감 '움직이기' 효과: 아이가 그린 선(strokes)과 도장(stamps)을 캔버스 한 장에 다시 그리며 움직인다.
//   wiggle  🌊 살랑살랑   선이 물결처럼 꿈틀꿈틀, 도장은 좌우로 흔들흔들
//   bounce  🏀 통통      선·도장이 하나씩 바닥으로 떨어져 통통 튀고, 가끔 다시 폴짝 (화면을 누르면 모두 폴짝)
//   rainbow 🌈 무지개 반짝 선 색이 무지개로 흘러가며 빛나고, 도장은 반짝반짝 커졌다 작아졌다
//   replay  🎬 다시 그리기 그린 순서대로 처음부터 다시 그려진다 (끝나면 onDone)
// 효과가 켜져 있는 동안 원래 그림(SVG·도장)은 App 쪽에서 숨기고, 이 캔버스가 위를 덮어 그리기를 막는다.
import React, { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77];

export default function PaintMotion({ effect, strokes, stamps, audio, onDone }) {
  const canvasRef = useRef(null);
  const tapRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // 그린 순서대로 (선·도장 모두 id 가 만든 시각)
    const items = [
      ...strokes.filter(s => s.points && s.points.length).map(s => {
        const ys = s.points.map(p => p.y), xs = s.points.map(p => p.x);
        return { kind: 'stroke', s, id: s.id, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) + s.width / 2 };
      }),
      ...stamps.map(st => ({ kind: 'stamp', s: st, id: st.id, minX: st.x - st.size / 2, maxX: st.x + st.size / 2, minY: st.y - st.size / 2, maxY: st.y + st.size / 2 }))
    ].sort((a, b) => a.id - b.id);
    items.forEach((it, i) => {
      it.idx = i;
      it.dy = 0; it.vy = 0; it.rest = 0; it.delay = i * 0.12; it.rot = 0; it.vr = 0;
      it.cx = (it.minX + it.maxX) / 2;
    });
    const totalPts = items.reduce((a, it) => a + (it.kind === 'stroke' ? it.s.points.length : 6), 0);
    const replayDur = Math.max(2.2, Math.min(10, totalPts * 0.018));
    let replayEndAt = null, lastNoteAt = -1, lastNoteIdx = -1;

    const strokePath = (pts, ox = 0, oy = 0, fx) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = fx ? fx(p, i) : [p.x + ox, p.y + oy];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (pts.length === 1) { const [x, y] = fx ? fx(pts[0], 0) : [pts[0].x + ox, pts[0].y + oy]; ctx.lineTo(x + 0.1, y + 0.1); }
    };
    const drawStamp = (st, ox, oy, rotDeg = 0, scale = 1, glow = 0) => {
      ctx.save();
      ctx.translate(st.x + ox, st.y + oy);
      ctx.rotate(((st.rotation || 0) + rotDeg) * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.font = `${st.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (glow) { ctx.shadowColor = `rgba(255,255,255,${glow})`; ctx.shadowBlur = st.size * 0.5; }
      ctx.fillText(st.icon, 0, 0);
      ctx.restore();
    };

    let raf = 0, last = performance.now(), t = 0, lastBoing = 0;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (effect === 'wiggle') {
        items.forEach(it => {
          if (it.kind === 'stroke') {
            const s = it.s, amp = 5 + s.width * 0.35;
            strokePath(s.points, 0, 0, (p, i) => [p.x + Math.sin(t * 3.1 + i * 0.31 + it.idx) * amp * 0.45, p.y + Math.sin(t * 4.2 + i * 0.22 + it.idx * 1.7) * amp]);
            ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
          } else {
            drawStamp(it.s, 0, Math.sin(t * 3 + it.idx) * 6, Math.sin(t * 4 + it.idx) * 18);
          }
        });
      } else if (effect === 'bounce') {
        if (tapRef.current) {   // 화면을 누르면 모두 폴짝!
          items.forEach(it => { it.vy = -(520 + Math.random() * 260); it.rest = 0; it.vr = (Math.random() - 0.5) * 240; it.delay = 0; });
          tapRef.current = 0;
          if (audio) audio.playFreq(660, 'triangle', 0.12, 0.3);
        }
        const g = 1500, floorPad = 6;
        items.forEach(it => {
          if (t < it.delay) return;
          const floorDy = H - floorPad - it.maxY;
          it.vy += g * dt; it.dy += it.vy * dt; it.rot += it.vr * dt;
          if (it.dy > floorDy) {
            it.dy = floorDy;
            if (Math.abs(it.vy) > 140) {
              if (audio && t - lastBoing > 0.07) { lastBoing = t; audio.playFreq(260 + Math.min(500, Math.abs(it.vy) * 0.4), 'sine', 0.09, 0.22); }
              it.vy = -it.vy * 0.58; it.vr *= 0.6;
            } else { it.vy = 0; it.vr *= 0.8; it.rest += dt; }
            if (it.rest > 1.6 + (it.idx % 5) * 0.5) { it.vy = -(380 + Math.random() * 320); it.rest = 0; it.vr = (Math.random() - 0.5) * 160; }
          }
          // 바닥에 닿는 순간 살짝 납작해진다
          const squash = it.dy >= floorDy - 0.5 && Math.abs(it.vy) > 0 ? 0.85 : 1;
          if (it.kind === 'stroke') {
            const s = it.s, cx = it.cx, by = it.maxY;
            ctx.save();
            ctx.translate(cx, by + it.dy); ctx.rotate(it.rot * Math.PI / 180 * 0.15); ctx.scale(1 / Math.sqrt(squash), squash);
            strokePath(s.points, -cx, -by);
            ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.globalAlpha = 0.9; ctx.stroke();
            ctx.restore();
          } else {
            drawStamp(it.s, 0, it.dy, it.rot * 0.3, 1);
          }
        });
      } else if (effect === 'rainbow') {
        items.forEach(it => {
          if (it.kind === 'stroke') {
            const s = it.s, pts = s.points;
            // 은은한 빛 번짐
            strokePath(pts);
            ctx.strokeStyle = `hsla(${(t * 90 + it.idx * 45) % 360},100%,70%,0.35)`; ctx.lineWidth = s.width * 2.2; ctx.stroke();
            // 무지개가 선을 따라 흘러간다 (점 몇 개씩 묶어 칠한다)
            ctx.lineWidth = s.width;
            const step = Math.max(1, Math.floor(pts.length / 60));
            for (let i = 0; i < pts.length - 1; i += step) {
              const j = Math.min(pts.length - 1, i + step);
              ctx.strokeStyle = `hsl(${(i * 9 - t * 240 + it.idx * 40) % 360 + 360},95%,55%)`;
              ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
            }
            if (pts.length === 1) { strokePath(pts); ctx.strokeStyle = `hsl(${(t * 240) % 360},95%,55%)`; ctx.stroke(); }
            // 반짝이 별 하나가 선을 따라 달린다
            const k = Math.floor(((t * 0.6 + it.idx * 0.17) % 1) * pts.length);
            const sp = pts[Math.min(pts.length - 1, k)];
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
            ctx.beginPath();
            for (let a = 0; a < 8; a++) { const r = a % 2 ? s.width * 0.35 : s.width * 0.9; ctx.lineTo(sp.x + Math.cos(a * TAU / 8 + t * 3) * r, sp.y + Math.sin(a * TAU / 8 + t * 3) * r); }
            ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
          } else {
            drawStamp(it.s, 0, 0, 0, 1 + Math.sin(t * 5 + it.idx) * 0.12, 0.6 + Math.sin(t * 5 + it.idx) * 0.4);
          }
        });
      } else if (effect === 'replay') {
        // 지금까지 그려진 양 (점 단위)
        let budget = Math.min(totalPts, (t / replayDur) * totalPts);
        items.forEach(it => {
          if (budget <= 0) return;
          if (it.kind === 'stroke') {
            const s = it.s, n = Math.min(s.points.length, Math.ceil(budget));
            budget -= s.points.length;
            strokePath(s.points.slice(0, n));
            ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
            if (n < s.points.length) {
              // 붓끝 반짝
              const p = s.points[n - 1];
              ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, s.width * 0.45, 0, TAU); ctx.fill();
            }
            if (audio && n > 0 && n < s.points.length && t - lastNoteAt > 0.13) { lastNoteAt = t; audio.playXylophone(NOTES[(it.idx * 2 + n) % NOTES.length]); }
          } else {
            const k = Math.min(1, budget / 6); budget -= 6;
            const pop = k < 1 ? 0.4 + k * 0.8 : 1;
            drawStamp(it.s, 0, 0, 0, pop);
            if (audio && lastNoteIdx < it.idx) { lastNoteIdx = it.idx; audio.playPopSound(); }
          }
        });
        if (t >= replayDur && replayEndAt == null) { replayEndAt = t; if (audio) audio.playFanfare(); }
        if (replayEndAt != null && t - replayEndAt > 1.4) { onDone && onDone(); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // 효과가 바뀌거나 처음 켤 때만 다시 시작 (켜져 있는 동안 그림은 바뀌지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => { e.stopPropagation(); tapRef.current = 1; }}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 5, display: 'block', touchAction: 'none' }}
    />
  );
}
