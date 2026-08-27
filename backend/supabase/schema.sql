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

-- 트래픽/사용 패턴 분석용 이벤트 로그 (Phase 10). 대시보드 없이 "일단 안전하게 쌓이는
-- 구조"만 목표라 SQL로 직접 조회하는 걸 전제로 설계함 — analytics.ts 참고.
--
-- 5개 이벤트 타입(미션 생성 요청/미션 종료/힌트 사용/공유/LLM 에러)을 테이블 하나에 모음.
-- 타입별로 테이블을 쪼개지 않은 이유: 세션 하나의 이벤트 흐름(생성→힌트 N회→종료→공유)을
-- 시간순으로 보려면 어차피 session_id로 조인해야 하는데, 테이블이 나뉘면 그 조인이 매번
-- 필요해짐. event_type + jsonb payload 조합이면 한 테이블에서 그대로 필터링·정렬 가능.
--
-- language/difficulty는 mission_talk_sessions에 이미 있는 값이라 중복이지만, 분석 시
-- 가장 자주 쪼개보는 두 축이라 매번 세션 테이블과 조인하지 않도록 일부러 여기에도 둠
-- (로그/이벤트 테이블에서 흔한 의도적 비정규화 — payload 안에 묻어두면 매번
-- payload->>'language' 같은 캐스팅이 필요해서 인덱스 활용도 떨어짐).
--
-- event_type을 Postgres enum이 아니라 text로 둔 이유: language/difficulty도 이미 이
-- 파일에서 text로 두고 있고(마이그레이션 없이 값 추가 가능하게 하려는 동일한 이유,
-- Step 1 Task 1-2), 새 이벤트 타입이 늘어날 걸 감안하면 enum은 ALTER TYPE 마이그레이션
-- 부담만 늘림.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- analytics.ts의 EventType과 반드시 일치시킬 것
  -- 세션이 (현재는 일어나지 않지만) 삭제되더라도 그 세션에서 나온 과거 이벤트 자체는
  -- 분석 이력으로 남겨야 하므로 CASCADE가 아니라 SET NULL.
  session_id uuid references mission_talk_sessions(id) on delete set null,
  user_key text, -- 완전 익명 식별키. 그 이상의 개인식별정보는 payload에도 절대 넣지 않음
  language text,
  difficulty text,
  payload jsonb not null default '{}'::jsonb, -- 이벤트 타입별 상세 필드 (analytics.ts 참고)
  created_at timestamptz not null default now()
);

-- "특정 이벤트 타입을 최신순으로" 조회하는 게 가장 흔한 질의 패턴이라 복합 인덱스로 커버.
create index if not exists analytics_events_type_created_idx
  on analytics_events (event_type, created_at desc);

-- "이 세션에서 무슨 일이 있었는지" 시간순 조회용.
create index if not exists analytics_events_session_idx
  on analytics_events (session_id, created_at);

-- mission_talk_sessions/mission_cache와 동일한 이유로 RLS 비활성 (서버 서비스 롤 키
-- 전용 접근, Step 12 C-2 참고). 클라이언트가 Supabase에 직접 붙는 구조로 바뀌면
-- 이 테이블도 그 즉시 RLS를 켜야 함.
