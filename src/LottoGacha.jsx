// 🎰 로또 캡슐 뽑기 탭: 동행복권 당첨 결과를 분석해 번호를 캡슐 뽑기로 한 개씩 뽑는다
// 데이터는 public/lotto/draws.json(빌드 전 scripts/update-lotto.mjs 가 갱신) + 열 때마다 Supabase 함수 lotto-draws 로 그 뒤 회차 확인
// 스타일은 다른 탭과 섞이지 않게 모두 lg- 로 시작 (LottoGacha.css)
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FIELDS, numsOf, ballClass, buildPopularityModel, buildStats, MODES, planSet, reasonFor,
  makeSetRanker, describeSet, rankOf, nextDrawInfo, fmtDate
} from './lottoLogic';
import { toRow } from './lottoRows';
import LottoMachine from './LottoMachine';
import './LottoGacha.css';

const SAVE_KEY = 'bps_lotto_saved_v1';
const SPIN_MS = 900;
const DROP_MS = 650;
const BASE = import.meta.env.BASE_URL || '/';
// 최신 회차 중계: baby-play-studio 전용 Supabase(서울) Edge Function → 동행복권 (supabase/functions/lotto-draws)
const LIVE_API = 'https://auaygojvfrvxmaerzmzi.supabase.co/functions/v1/lotto-draws';

const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
  } catch {
    return [];
  }
};
const storeSaved = (list) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch { /* 저장 공간 문제는 무시 */ }
};

// 당첨 결과: draws.json 을 읽고, 중계 함수로 그 뒤 회차를 더 받음 (추첨이 끝나면 바로 보임)
const useDraws = () => {
  const [state, setState] = useState({ draws: null, updatedAt: null, live: false, error: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let draws = [];
      let updatedAt = null;
      try {
        const res = await fetch(`${BASE}lotto/draws.json`, { cache: 'no-cache' });
        const json = await res.json();
        draws = json.draws;
        updatedAt = json.updatedAt;
      } catch {
        if (!cancelled) setState(s => ({ ...s, error: '당첨 번호 데이터를 읽지 못했어요.' }));
        return;
      }
      if (!cancelled) setState({ draws, updatedAt, live: false, error: null });
      let live = false;
      try {
        for (let i = 0; i < 3; i++) {
          const max = draws[draws.length - 1][FIELDS.round];
          // 아직 없는 회차를 기준으로 물으면 빈 목록이 오므로, 가진 마지막 회차를 기준으로 묻는다
          // (응답은 최신 회차까지 잘려서 그 뒤 새 회차들이 같이 옴)
          const res = await fetch(`${LIVE_API}?round=${max}`, { cache: 'no-cache' });
          if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) break;
          const list = (await res.json())?.data?.list;
          if (!Array.isArray(list)) break;
          live = true;
          const fresh = list.map(toRow).filter(r => r[FIELDS.round] > max).sort((a, b) => a[0] - b[0]);
          if (fresh.length === 0) break;
          draws = [...draws, ...fresh];
          updatedAt = new Date().toISOString();
        }
      } catch { /* 중계가 안 되면 draws.json 만 씀 */ }
      if (!cancelled) setState({ draws, updatedAt, live, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
};

const Ball = ({ n, size = 'md', className = '' }) => (
  <span className={`lg-ball ${ballClass(n)} lg-ball-${size} ${className}`}>{n}</span>
);

// 회차별 실제 당첨 번호 (‹ › 로 넘기거나 회차를 입력)
function ResultsView({ draws, startRound, saved }) {
  const first = draws[0][FIELDS.round];
  const latest = draws[draws.length - 1][FIELDS.round];
  const byRound = useMemo(() => new Map(draws.map(r => [r[FIELDS.round], r])), [draws]);
  const [round, setRound] = useState(startRound || latest);
  const [input, setInput] = useState('');
  const row = byRound.get(round);
  const go = (r) => setRound(Math.min(latest, Math.max(first, r)));
  const mine = saved.filter(s => s.round === round);
  const won = (n) => `${Number(n).toLocaleString('ko-KR')}`;

  return (
    <div className="lg-stack">
      <section className="lg-card lg-draw">
        <div className="lg-draw-nav">
          <button type="button" className="lg-btn" onClick={() => go(round - 1)} disabled={round <= first} aria-label="이전 회차">‹ 이전</button>
          <div className="lg-draw-title">
            <b>{round}회</b>
            <small>{row ? `${fmtDate(row[FIELDS.date])} 추첨` : ''}{round === latest ? ' · 최신' : ''}</small>
          </div>
          <button type="button" className="lg-btn" onClick={() => go(round + 1)} disabled={round >= latest} aria-label="다음 회차">다음 ›</button>
        </div>
        {row && (
          <>
            <div className="lg-balls is-big lg-draw-balls">
              {numsOf(row).map(n => <Ball key={n} n={n} className="lg-pop" />)}
              <span className="lg-plus">+</span>
              <Ball n={row[FIELDS.bonus]} className="lg-pop" />
            </div>
            <p className="lg-draw-bonus">당첨 번호 6개 + 보너스</p>
            <table className="lg-prize">
              <thead>
                <tr><th>순위</th><td>조건</td><td className="lg-num">당첨자</td><td className="lg-num">1인당 당첨금</td></tr>
              </thead>
              <tbody>
                {[['1등', '6개 일치'], ['2등', '5개 + 보너스'], ['3등', '5개 일치'], ['4등', '4개 일치'], ['5등', '3개 일치']].map(([rank, rule], i) => {
                  const amount = row[FIELDS.a1 + i];
                  return (
                    <tr key={rank}>
                      <th>{rank}</th>
                      <td>{rule}</td>
                      <td className="lg-num">{won(row[FIELDS.w1 + i])}명</td>
                      <td className="lg-num lg-amt">{amount ? `${won(amount)}원` : row[FIELDS.w1 + i] === 0 ? '당첨자 없음' : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {row[FIELDS.a1] >= 100000000 && <p className="lg-hint">1등 1인당 약 {(row[FIELDS.a1] / 100000000).toFixed(1)}억 원 (세금 떼기 전)</p>}
            {row[FIELDS.sales] > 0 && <p className="lg-hint">총 판매액 {won(Math.round(row[FIELDS.sales] / 100000000))}억 원</p>}
          </>
        )}
        <form
          className="lg-draw-jump"
          onSubmit={(e) => {
            e.preventDefault();
            const r = parseInt(input, 10);
            if (r) go(r);
            setInput('');
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            placeholder={`회차 입력 (${first}~${latest})`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="lg-btn">이동</button>
          {round !== latest && <button type="button" className="lg-btn is-ghost" onClick={() => setRound(latest)}>최신 회차</button>}
        </form>
      </section>

      {mine.length > 0 && (
        <section className="lg-card">
          <h2>이 회차에 저장한 내 번호</h2>
          <div className="lg-stack">
            {mine.map(s => {
              const rank = rankOf(s.nums, row);
              const win = numsOf(row);
              return (
                <div key={s.at} className="lg-saved-head">
                  <div className="lg-balls">
                    {s.nums.map(n => <Ball key={n} n={n} size="sm" className={win.includes(n) ? '' : 'is-dim'} />)}
                  </div>
                  <span className={`lg-badge ${rank ? 'is-win' : 'is-lose'}`}>{rank ? `${rank}등!` : '낙첨'}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatsView({ draws, model, stats }) {
  const [metric, setMetric] = useState('popularity');
  const values = useMemo(() => {
    const v = [];
    for (let n = 1; n <= 45; n++) {
      if (metric === 'popularity') v[n] = model.percentile(n);
      else if (metric === 'recent') v[n] = stats.recent[n] / Math.max(...stats.recent);
      else v[n] = Math.min(stats.gap[n], 30) / 30;
    }
    return v;
  }, [metric, model, stats]);
  const label = (n) => (metric === 'popularity'
    ? `인기 상위 ${100 - Math.round(model.percentile(n) * 100)}%`
    : metric === 'recent' ? `최근 ${stats.recentN}회 ${stats.recent[n]}번` : `${stats.gap[n]}회째 안 나옴`);
  const ranked = [...Array(45)].map((_, i) => i + 1).sort((a, b) => model.beta[a - 1] - model.beta[b - 1]);

  return (
    <div className="lg-stack">
      <section className="lg-card">
        <h2>번호 지도</h2>
        <div className="lg-seg">
          {[['popularity', '사람들이 고르는 정도'], ['recent', `최근 ${stats.recentN}회 출현`], ['gap', '안 나온 기간']].map(([k, l]) => (
            <button key={k} type="button" className={metric === k ? 'is-on' : ''} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
        <div className="lg-heat">
          {values.map((v, n) => n > 0 && (
            <div key={n} className="lg-heat-cell" style={{ '--v': v }} title={`${n}: ${label(n)}`}>
              <b>{n}</b>
              <small>{metric === 'popularity' ? `${Math.round(v * 100)}` : metric === 'recent' ? stats.recent[n] : stats.gap[n]}</small>
            </div>
          ))}
        </div>
        <p className="lg-hint">
          {metric === 'popularity'
            ? '숫자가 클수록(진할수록) 많은 사람이 고르는 번호예요. 0~100 백분위.'
            : metric === 'recent' ? '최근 출현 횟수는 다음 회차 확률과 상관없어요 (재미용).' : '안 나온 기간도 다음 회차 확률과 상관없어요 (재미용).'}
        </p>
      </section>

      <section className="lg-card">
        <h2>인기도 분석</h2>
        <p className="lg-hint">
          {model.rounds}개 회차의 3~5등 당첨자 수를 판매량과 비교해, 어떤 번호·무늬를 사람들이 많이 고르는지 추정했어요.
          과거로 학습해 최근 회차를 맞혀 본 정확도(상관계수)는 <b>{model.holdoutCorr.toFixed(2)}</b> 입니다.
        </p>
        <div className="lg-pop-row"><span>많이 고르는 번호</span><div>{ranked.slice(-8).reverse().map(n => <Ball key={n} n={n} size="sm" />)}</div></div>
        <div className="lg-pop-row"><span>덜 고르는 번호</span><div>{ranked.slice(0, 8).map(n => <Ball key={n} n={n} size="sm" />)}</div></div>
        <p className="lg-hint">6개가 모두 31 이하(생일 범위)이거나 끝자리가 같은 번호가 많으면 인기가 더 올라가요.</p>
      </section>

      <section className="lg-card">
        <h2>최근 당첨 번호</h2>
        <div className="lg-recent">
          {draws.slice(-10).reverse().map(r => (
            <div key={r[0]} className="lg-recent-row">
              <div className="lg-recent-meta"><b>{r[0]}회</b><small>{fmtDate(r[FIELDS.date])} · 1등 {r[FIELDS.w1]}명</small></div>
              <div className="lg-balls">
                {numsOf(r).map(n => <Ball key={n} n={n} size="sm" />)}
                <span className="lg-plus">+</span>
                <Ball n={r[FIELDS.bonus]} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// audio: BabySoundEngine (레버·캡슐 효과음)
export default function LottoGacha({ audio }) {
  const { draws, updatedAt, live, error } = useDraws();
  const [tab, setTab] = useState('gacha');
  const [mode, setMode] = useState('smart');
  const [picks, setPicks] = useState([]); // [{ n, reason: { short, long } }]
  const [spinning, setSpinning] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState(loadSaved);
  const [toast, setToast] = useState('');
  const timers = useRef([]);
  const planRef = useRef(null); // 이번 판에 나올 6개 (뽑을 때마다 앞에서부터 하나씩 보여 줌)

  const model = useMemo(() => (draws ? buildPopularityModel(draws) : null), [draws]);
  const stats = useMemo(() => (draws ? buildStats(draws) : null), [draws]);
  const rankSet = useMemo(() => (model ? makeSetRanker(model) : null), [model]);
  const next = draws ? nextDrawInfo(draws) : null;
  const drawByRound = useMemo(() => new Map((draws || []).map(r => [r[FIELDS.round], r])), [draws]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const beep = (freq, type = 'sine', dur = 0.12) => {
    try {
      audio?.playFreq?.(freq, type, dur);
    } catch { /* 소리 실패는 무시 */ }
  };
  const flash = (msg) => {
    setToast(msg);
    later(() => setToast(''), 1800);
  };

  const done = picks.length === 6;
  const busy = spinning || dropping;

  const ensurePlan = () => {
    if (!planRef.current) planRef.current = planSet(mode, { model, stats }, rankSet);
    return planRef.current;
  };

  const spin = () => {
    if (!model || busy || done) return;
    const n = ensurePlan()[picks.length];
    setSpinning(true);
    setCurrent(null);
    [0, 150, 300, 450, 600, 750].forEach((t, i) => later(() => beep(300 + i * 40, 'triangle', 0.06), t));
    later(() => {
      setSpinning(false);
      setCurrent(n);
      setDropping(true);
      beep(220, 'sine', 0.15);
    }, SPIN_MS);
    later(() => {
      setDropping(false);
      setPicks(prev => [...prev, { n, reason: reasonFor(n, mode, { model, stats }) }]);
      beep(880, 'sine', 0.18);
      later(() => beep(1175, 'sine', 0.2), 110);
    }, SPIN_MS + DROP_MS);
  };

  const spinAll = () => {
    if (!model || busy || done) return;
    const added = ensurePlan().slice(picks.length).map(n => ({ n, reason: reasonFor(n, mode, { model, stats }) }));
    setCurrent(added[added.length - 1].n);
    setPicks(prev => [...prev, ...added]);
    beep(988, 'sine', 0.2);
  };

  const reset = () => {
    if (busy) return;
    planRef.current = null;
    setPicks([]);
    setCurrent(null);
  };

  const sortedNums = [...picks.map(p => p.n)].sort((a, b) => a - b);
  const info = done ? describeSet(sortedNums) : null;
  const popPct = done && rankSet ? Math.round(rankSet(sortedNums) * 100) : null;

  const save = () => {
    if (!done || !next) return;
    if (saved.some(s => s.round === next.round && s.nums.join() === sortedNums.join())) {
      flash('이미 저장한 조합이에요');
      return;
    }
    const list = [{ round: next.round, nums: sortedNums, mode, at: Date.now() }, ...saved];
    setSaved(list);
    storeSaved(list);
    flash(`${next.round}회 번호로 저장했어요`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sortedNums.join(', '));
      flash('번호를 복사했어요');
    } catch {
      flash(sortedNums.join(', '));
    }
  };

  const removeSaved = (at) => {
    const list = saved.filter(s => s.at !== at);
    setSaved(list);
    storeSaved(list);
  };

  if (error) return <div className="lg-root"><p className="lg-empty">{error}</p></div>;
  if (!draws || !model) return <div className="lg-root"><p className="lg-empty">당첨 번호 불러오는 중…</p></div>;

  const last = draws[draws.length - 1];

  return (
    <div className={`lg-root ${tab === 'gacha' ? 'is-gacha' : ''}`}>
      <header className="lg-top">
        <div>
          <h1>🎰 로또 캡슐 뽑기</h1>
          <p className="lg-sub">
            {next.round}회 · {fmtDate(next.date)}(토) 추첨 · 지난 {last[0]}회까지 {draws.length}회 분석
            {live ? ' · 실시간 확인됨' : ''}
          </p>
        </div>
        <nav className="lg-seg">
          <button type="button" className={tab === 'gacha' ? 'is-on' : ''} onClick={() => setTab('gacha')}>뽑기</button>
          <button type="button" className={tab === 'results' ? 'is-on' : ''} onClick={() => setTab('results')}>당첨 번호</button>
          <button type="button" className={tab === 'saved' ? 'is-on' : ''} onClick={() => setTab('saved')}>저장 {saved.length > 0 ? saved.length : ''}</button>
          <button type="button" className={tab === 'stats' ? 'is-on' : ''} onClick={() => setTab('stats')}>분석</button>
        </nav>
      </header>

      {tab === 'gacha' && (
        <div className="lg-gacha-layout">
          <section className="lg-card lg-gacha-card">
            <LottoMachine
              spinning={spinning}
              dropping={dropping}
              current={current}
              onSpin={spin}
              disabled={busy || done}
              label={done ? '6개 다 뽑았어요' : busy ? '뽑는 중…' : `레버 돌리기 (${picks.length + 1}/6)`}
              removed={[...new Set([...picks.map(p => p.n), ...(current ? [current] : [])])]}
            />
            <div className="lg-tray">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="lg-slot">
                  {picks[i] ? (
                    <>
                      <Ball n={picks[i].n} className="lg-pop" />
                      <small title={picks[i].reason.long}>{picks[i].reason.short}</small>
                    </>
                  ) : (
                    <span className="lg-slot-empty">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="lg-row-btns">
              {!done && <button type="button" className="lg-btn is-ghost" onClick={spinAll} disabled={busy}>남은 번호 한 번에 뽑기</button>}
              {picks.length > 0 && <button type="button" className="lg-btn is-ghost" onClick={reset} disabled={busy}>처음부터</button>}
            </div>
          </section>
          <button type="button" className="lg-card lg-last" onClick={() => setTab('results')}>
            <div className="lg-last-head">
              <b>지난 {last[0]}회 당첨 번호</b>
              <small>{fmtDate(last[FIELDS.date])} · 1등 {last[FIELDS.w1]}명</small>
              <span className="lg-last-more">지난 회차 보기 ›</span>
            </div>
            <div className="lg-balls">
              {numsOf(last).map(n => <Ball key={n} n={n} size="sm" />)}
              <span className="lg-plus">+</span>
              <Ball n={last[FIELDS.bonus]} size="sm" />
            </div>
          </button>
          <section className="lg-card">
            <div className="lg-modes">
              {Object.entries(MODES).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  className={`lg-mode ${mode === key ? 'is-on' : ''}`}
                  onClick={() => !busy && picks.length === 0 && setMode(key)}
                  disabled={busy || (picks.length > 0 && mode !== key)}
                >
                  <span className="lg-mode-emoji">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            <p className="lg-hint">{MODES[mode].desc}{picks.length > 0 && picks.length < 6 ? ' (뽑는 중에는 모드를 바꿀 수 없어요)' : ''}</p>
          </section>
          {done ? (
            <section className="lg-card lg-result">
              <h2>이번 조합</h2>
              <div className="lg-balls is-big">{sortedNums.map(n => <Ball key={n} n={n} />)}</div>
              <ul className="lg-facts">
                <li>
                  <span>인기도</span>
                  <b>{popPct <= 33 ? '덜 고르는 조합' : popPct >= 67 ? '많이 고르는 조합' : '보통'}</b>
                  <small>무작위 조합 중 하위 {Math.max(popPct, 1)}%</small>
                </li>
                <li><span>홀:짝</span><b>{info.odd}:{info.even}</b></li>
                <li><span>합계</span><b>{info.sum}</b><small>보통 100~175</small></li>
                <li><span>무늬</span><b>{info.patterns.length ? info.patterns.join(', ') : '없음'}</b></li>
              </ul>
              <div className="lg-row-btns">
                <button type="button" className="lg-btn is-primary" onClick={save}>저장</button>
                <button type="button" className="lg-btn" onClick={copy}>복사</button>
                <button type="button" className="lg-btn" onClick={reset}>다시 뽑기</button>
              </div>
            </section>
          ) : (
            <section className="lg-card lg-result is-waiting">
              <p>레버를 돌려 번호 6개를 다 뽑으면<br />여기에 이번 조합 분석이 나와요</p>
            </section>
          )}
          <p className="lg-notice">
            모든 조합의 1등 확률은 똑같이 8,145,060분의 1이에요. 이 기능은 확률을 높이지 못하고, &apos;덜 겹치는 번호&apos;는
            당첨됐을 때 같은 번호를 산 사람이 적을 조합을 고를 뿐이에요. 정해 둔 금액 안에서 재미로만 즐기세요.
          </p>
        </div>
      )}

      {tab === 'saved' && (
        <div className="lg-stack lg-narrow">
          {saved.length === 0 && <p className="lg-empty">저장한 번호가 없어요. 뽑기에서 6개를 뽑고 저장해 보세요.</p>}
          {saved.map(s => {
            const row = drawByRound.get(s.round);
            const rank = row ? rankOf(s.nums, row) : null;
            const win = row ? numsOf(row) : [];
            return (
              <div key={s.at} className="lg-card lg-saved">
                <div className="lg-saved-head">
                  <b>{s.round}회</b>
                  <small>{MODES[s.mode]?.emoji} {MODES[s.mode]?.label}</small>
                  <span className={`lg-badge ${rank ? 'is-win' : row ? 'is-lose' : ''}`}>
                    {row ? (rank ? `${rank}등!` : '낙첨') : '추첨 전'}
                  </span>
                  <button type="button" className="lg-x" onClick={() => removeSaved(s.at)} aria-label="지우기">×</button>
                </div>
                <div className="lg-balls">
                  {s.nums.map(n => <Ball key={n} n={n} size="sm" className={row && !win.includes(n) ? 'is-dim' : ''} />)}
                </div>
                {row && (
                  <small className="lg-hint">
                    당첨 번호 {win.join(', ')} + {row[FIELDS.bonus]} · {s.nums.filter(n => win.includes(n)).length}개 맞음
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'results' && <div className="lg-narrow"><ResultsView draws={draws} saved={saved} /></div>}

      {tab === 'stats' && <div className="lg-narrow"><StatsView draws={draws} model={model} stats={stats} /></div>}

      <footer className="lg-foot">
        데이터: 동행복권 당첨 결과 ({updatedAt ? `${fmtDate(new Date(updatedAt))} 갱신` : ''}) · 비공식 조회 주소를 써서 바뀌면 갱신이 멈출 수 있어요
      </footer>
      {toast && <div className="lg-toast">{toast}</div>}
    </div>
  );
}
