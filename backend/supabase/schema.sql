-- Supabase SQL editor에서 실행하세요.
create table if not exists mission_talk_sessions (
  id uuid primary key default gen_random_uuid(),
  user_key text, -- 앱인토스 User.getAnonymousKey() hash. 로컬 브라우저 개발 중엔 기기별 UUID 폴백값 (identity.ts 참고)
  language text not null,
  difficulty text not null,
  role text not null,
  personality text not null,
  persona jsonb not null,
  turns jsonb not null default '[]'::jsonb,
  mission_complete boolean not null default false,
  ended_reason text,
  certificate jsonb, -- /certificate/generate 결과 캐시. 재조회·향후 "내 수료증 이력" 기능의 기반 데이터
  created_at timestamptz not null default now()
);

create index if not exists mission_talk_sessions_user_key_idx
  on mission_talk_sessions (user_key);

-- 서버(서비스 롤 키)에서만 접근하고 프론트엔드는 Supabase에 직접 접근하지 않는 구조라
-- RLS는 비활성 상태로 둠 (Step 12 감사 C-2 결론). 클라이언트에서 직접 Supabase에
-- 접근하는 구조로 바뀌면 그 즉시 RLS를 켜고 정책을 추가해야 함.
