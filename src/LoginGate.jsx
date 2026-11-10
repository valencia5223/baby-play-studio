// 🔐 로그인 문: 로그인한 세션이 있으면 바로 앱(children)을, 없으면 아이디·비밀번호 화면을 보여 준다
//  - 세션은 이 기기(localStorage 'bps_auth')에 남아 다음 접속부터 자동 로그인. 인터넷이 끊겨도 저장된 세션으로 들어간다
//  - 세션이 서버에서 끊기면(비밀번호 변경·계정 삭제 등) SIGNED_OUT 이 와서 다시 로그인 화면이 된다
import React, { useEffect, useState } from 'react';
import { supabase, idToEmail } from './auth.js';

const JUA = "'Jua', 'Gowun Dodum', sans-serif";

export default function LoginGate({ children }) {
  const [state, setState] = useState('loading');   // loading | in | out
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setState(data.session ? 'in' : 'out'); }).catch(() => { if (alive) setState('out'); });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => { if (alive) setState(session ? 'in' : 'out'); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (import.meta.env.DEV && window.location.search.includes('devskip')) return children;   // 개발 서버 자동 테스트용 (배포본에는 없음)
  if (state === 'in') return children;
  if (state === 'loading') return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: JUA, fontSize: '2rem', color: '#c084fc' }}>🐼</div>;
  return <LoginForm />;
}

function LoginForm() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!id.trim() || !pw) { setErr('아이디와 비밀번호를 넣어 주세요'); return; }
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: idToEmail(id), password: pw });
      if (error) setErr(error.status === 400 || /invalid/i.test(error.message) ? '아이디나 비밀번호가 맞지 않아요' : `로그인하지 못했어요 (${error.message})`);
    } catch {
      setErr('인터넷 연결을 확인해 주세요');
    }
    setBusy(false);
  };
  const field = { width: '100%', boxSizing: 'border-box', minHeight: '56px', borderRadius: '18px', border: '2px solid #e9d5ff', padding: '0 18px', fontSize: '1.2rem', outline: 'none', background: '#ffffff' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box', background: 'radial-gradient(circle at 20% 15%, #ffe4ef 0, rgba(255,228,239,0) 45%), radial-gradient(circle at 80% 85%, #e0f2fe 0, rgba(224,242,254,0) 45%), #fffaf5' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.92)', borderRadius: '32px', padding: '32px 28px', boxShadow: '0 24px 50px -24px rgba(124,58,237,0.45)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ textAlign: 'center', fontSize: '3rem' }}>🐼</div>
        <h1 style={{ margin: 0, textAlign: 'center', fontFamily: JUA, fontWeight: 400, fontSize: '1.8rem', color: '#6d28d9' }}>유나의 두뇌 발달 놀이터</h1>
        <div style={{ textAlign: 'center', color: '#9ca3af', fontWeight: 700, marginBottom: '6px' }}>한 번 들어오면 다음부터는 바로 열려요</div>
        <input value={id} onChange={e => setId(e.target.value)} placeholder="아이디" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={field} />
        <input value={pw} onChange={e => setPw(e.target.value)} placeholder="비밀번호" type="password" autoComplete="current-password" style={field} />
        {err && <div style={{ color: '#be123c', background: '#fff1f2', borderRadius: '14px', padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ minHeight: '58px', border: 'none', borderRadius: '20px', background: busy ? '#c4b5fd' : '#8b5cf6', color: '#ffffff', fontFamily: JUA, fontSize: '1.4rem', cursor: busy ? 'default' : 'pointer', touchAction: 'manipulation' }}>{busy ? '들어가는 중...' : '들어가기'}</button>
      </form>
    </div>
  );
}

// 🔒 부모용 계정 버튼 (헤더 부모용 묶음에 둔다): 누르면 비밀번호 바꾸기·로그아웃 창
export function AccountButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="계정 (비밀번호 바꾸기)" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '17px',
        border: 'none', background: 'transparent', color: '#7c6f66', fontSize: '0.95rem', cursor: 'pointer'
      }}>🔒</button>
      {open && <AccountPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountPanel({ onClose }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }
  const [who, setWho] = useState('');
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { const e = data.session && data.session.user.email; if (e) setWho(e.split('@')[0]); }); }, []);
  const change = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { setMsg({ ok: false, text: '비밀번호는 6글자 이상으로 해 주세요' }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: '두 번 넣은 비밀번호가 달라요' }); return; }
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) setMsg({ ok: false, text: /different/i.test(error.message) ? '지금 비밀번호와 다른 걸로 해 주세요' : `바꾸지 못했어요 (${error.message})` });
      else { setMsg({ ok: true, text: '비밀번호를 바꿨어요! 다른 기기에서는 새 비밀번호로 들어와요' }); setPw(''); setPw2(''); }
    } catch {
      setMsg({ ok: false, text: '인터넷 연결을 확인해 주세요' });
    }
    setBusy(false);
  };
  const logout = async () => { if (window.confirm('로그아웃할까요? 다시 들어올 때 아이디와 비밀번호가 필요해요.')) await supabase.auth.signOut(); };
  const field = { width: '100%', boxSizing: 'border-box', minHeight: '50px', borderRadius: '16px', border: '2px solid #e9d5ff', padding: '0 16px', fontSize: '1.1rem', outline: 'none', background: '#ffffff' };
  const btn = (bg, color) => ({ minHeight: '50px', border: 'none', borderRadius: '16px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', padding: '0 18px' });
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(40,30,60,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <form onClick={e => e.stopPropagation()} onSubmit={change} style={{ width: '100%', maxWidth: '380px', background: '#ffffff', borderRadius: '28px', padding: '26px 24px', boxShadow: '0 24px 50px -20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: '#6d28d9', textAlign: 'center' }}>🔒 비밀번호 바꾸기</div>
        {who && <div style={{ textAlign: 'center', color: '#9ca3af', fontWeight: 700 }}>아이디: {who}</div>}
        <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="새 비밀번호 (6글자 이상)" autoComplete="new-password" style={field} />
        <input value={pw2} onChange={e => setPw2(e.target.value)} type="password" placeholder="새 비밀번호 한 번 더" autoComplete="new-password" style={field} />
        {msg && <div style={{ color: msg.ok ? '#047857' : '#be123c', background: msg.ok ? '#ecfdf5' : '#fff1f2', borderRadius: '14px', padding: '10px 14px', fontWeight: 700, textAlign: 'center', lineHeight: 1.5 }}>{msg.text}</div>}
        <button type="submit" disabled={busy} style={btn(busy ? '#c4b5fd' : '#8b5cf6', '#ffffff')}>{busy ? '바꾸는 중...' : '바꾸기'}</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onClose} style={{ ...btn('#f3f4f6', '#374151'), flex: 1 }}>닫기</button>
          <button type="button" onClick={logout} style={{ ...btn('#fff1f2', '#be123c'), flex: 1 }}>로그아웃</button>
        </div>
      </form>
    </div>
  );
}
