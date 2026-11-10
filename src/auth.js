// 🔐 로그인 (baby-play-studio 전용 Supabase 프로젝트의 Auth. Library of Mind 의 Supabase 와 섞지 말 것)
//  - 계정은 가입 화면 없이 관리자가 만든다 (Supabase 대시보드 Authentication › Users, 또는 관리자 키로 admin API)
//  - 아이디만 넣으면 뒤에 ID_DOMAIN 을 붙여 이메일 형식으로 로그인한다 (yuna → yuna@baby-play-studio.local)
//  - 한 번 로그인하면 이 기기에 세션이 저장되고 저절로 갱신되어 다음부터는 바로 들어간다
//  - anon 키는 원래 웹에 공개되는 키다 (관리자 키는 절대 여기에 넣지 않는다)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://auaygojvfrvxmaerzmzi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1YXlnb2p2ZnJ2eG1hZXJ6bXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTYxMzgsImV4cCI6MjEwNzAzMjEzOH0.5q_66aQVU848iB65WZ7mIJYtMv4RVXD-rveGsKYX6dg';
export const ID_DOMAIN = 'baby-play-studio.local';

// 브라우저에서만 만든다 (음성 생성 스크립트가 Node 로 App.jsx 를 불러올 때는 WebSocket 이 없어 오류가 나므로 건너뜀)
export const supabase = typeof window === 'undefined' ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'bps_auth' }
});

export const idToEmail = (id) => {
  const v = id.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${ID_DOMAIN}`;
};
