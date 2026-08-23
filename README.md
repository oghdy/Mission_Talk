# 미션톡 (MissionTalk) — 스캐폴딩

명세서 기준 초기 골격입니다. `backend/`는 Express + Claude API(`claude-opus-5`) + Supabase, `frontend/`는 Vite + React + TypeScript로 구성했습니다.

## 구조

```
backend/    POST /persona/generate, /chat/turn, /certificate/generate
frontend/   입력 -> 로딩 -> 대화 -> 결과 4개 화면
```

## 실행

```bash
cd backend && npm install && cp .env.example .env && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

`ant auth login`으로 인증되어 있다면 `.env`의 `ANTHROPIC_API_KEY`는 비워둬도 됩니다.

Supabase를 쓰려면 [backend/supabase/schema.sql](backend/supabase/schema.sql)을 프로젝트 SQL editor에서 한 번 실행하고, `.env`에 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`를 채워주세요.

## 이번 스캐폴딩에서 임시로 정한 값 (명세서 10절 TBD 항목)

- **턴 카운트 기준**: 사용자 발화 기준 최대 7턴 (`MAX_USER_TURNS`, [backend/src/types.ts](backend/src/types.ts)). 7턴은 상한선일 뿐이고, LLM이 미션 달성으로 판정하면 그 즉시(예: 5턴) `cleared`로 조기 종료됨 ([backend/src/routes/chat.ts](backend/src/routes/chat.ts))
- **7턴 초과 시**: 실패로 종료, 재도전은 프론트에서 자유롭게 다시 시작 가능하도록 구현
- **수료증 등급 라벨**: 3단계("아주 잘했어요" / "괜찮아요" / "이 표현은 어색해요") 임시 고정 ([backend/src/llm/certificate.ts](backend/src/llm/certificate.ts))
- **난이도별 정책**: 프롬프트 문구로만 반영, 별도 어휘 리스트/힌트 로직 없음 ([backend/src/llm/persona.ts](backend/src/llm/persona.ts))
- **자유입력 가드레일**: 시스템 프롬프트에 "부적절/무관한 입력은 무난한 상황으로 대체" 지시만 포함, 별도 필터링 레이어 없음
- **세션 저장소**: Supabase (`mission_talk_sessions` 테이블, [backend/src/store.ts](backend/src/store.ts)) — 서비스 롤 키로 서버에서만 접근, RLS는 아직 미설정. `user_key` 컬럼은 앱인토스 익명 식별키 연동 전까지 null

## 미구현 (앱인토스 SDK 연동 필요)

- 사용자 식별키 발급/전달
- Share SDK (수료증 카카오톡 공유) — [ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx)에 버튼만 배치
- 수료증 이미지/PDF 생성 (파일 SDK)
- Storage 연동
