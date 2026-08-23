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

-- (언어, 난이도, 상대방, 성격) 조합별로 생성된 페르소나+미션을 모아두는 풀.
-- 같은 조합이 반복되면(주로 랜덤 채우기 버튼 사용자) 매번 새로 LLM을 호출하지 않고
-- 풀에서 랜덤으로 하나 재사용 — 토큰 절감 + 완전 복붙 반복은 피하는 절충안 (missionCache.ts 참고).
create table if not exists mission_cache (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  difficulty text not null,
  role_key text not null, -- 정규화된(trim+lowercase) 매칭용 값
  personality_key text not null,
  role_raw text not null, -- 실제 사용자가 입력한 원문 (튜닝/디버깅용)
  personality_raw text not null,
  persona jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mission_cache_lookup_idx
  on mission_cache (language, difficulty, role_key, personality_key);
