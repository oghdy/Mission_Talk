# 미션톡 개발문서

바이브코딩으로 진행되는 프로젝트라, 나중에 유지보수/확장 지시를 정확히 내리기 위해 Phase → Step → Task 단위로 기록. 상태 태그: `[AGENT 완료]` 구현+검증 완료, `[AGENT]` 구현했지만 미검증, `(USER 액션: ...)` 사용자가 직접 해야 하는 것, `[TBD]` 아직 결정 안 됨.

---

## Phase 1: 프로젝트 스캐폴딩

### Step 1: 백엔드 기본 구조 (Express + TypeScript)

*전략: WebView 미니앱이라 화면 수가 적고, 백엔드는 명세서 7절 API 초안 그대로 3개 엔드포인트(`/persona/generate`, `/chat/turn`, `/certificate/generate`)로 단순 구성.*

- **Task 1-1: [Backend] Express + TypeScript 프로젝트 초기 설정** `[AGENT 완료]`
  - ESM(NodeNext) 기반, `tsx watch`로 개발 서버
  - 관련 파일: [backend/package.json](backend/package.json), [backend/tsconfig.json](backend/tsconfig.json)
- **Task 1-2: [Backend] 공통 타입 정의** `[AGENT 완료]`
  - `Language`(en/ja/zh/es), `Difficulty`(easy/medium/hard), `Session`, `MAX_USER_TURNS = 7`
  - 관련 파일: [backend/src/types.ts](backend/src/types.ts)
- **Task 1-3: [Backend] 세션 저장소 1차 구현 (인메모리)** `[AGENT 완료 — Step 4에서 Supabase로 교체]`
  - 관련 파일: [backend/src/store.ts](backend/src/store.ts)

### Step 2: Claude API 연동 (LLM 호출 레이어)

*전략: 엔드포인트마다 LLM 호출 함수를 분리(persona/chat/certificate)하고, Zod 스키마 + structured output(`output_config.format`)으로 파싱 실패 리스크 최소화.*

- **Task 2-1: [LLM] Anthropic 클라이언트 초기화** `[AGENT 완료]`
  - 관련 파일: [backend/src/llm/client.ts](backend/src/llm/client.ts)
  - 모델: 최초 `claude-opus-5` → Step 5에서 `claude-sonnet-5`로 변경됨
- **Task 2-2: [LLM] 페르소나 + 미션 생성 함수** `[AGENT 완료]`
  - 입력(언어/상대방/성격/난이도) → `personaPrompt`, `missionGoal`, `openingLine` 생성
  - 관련 파일: [backend/src/llm/persona.ts](backend/src/llm/persona.ts)
- **Task 2-3: [LLM] 대화 턴 처리 함수 (미션 판정 포함)** `[AGENT 완료 — Step 6에서 캐싱 구조로 리팩토링]`
  - 매턴 `replyText` + `missionComplete` boolean을 함께 구조화 출력으로 판정
  - 관련 파일: [backend/src/llm/chat.ts](backend/src/llm/chat.ts)
- **Task 2-4: [LLM] 수료증(턴별 평가) 생성 함수** `[AGENT 완료 — Step 8에서 5단계로 확정]`
  - 등급 3단계 임시 고정: "아주 잘했어요" / "괜찮아요" / "이 표현은 어색해요"
  - 관련 파일: [backend/src/llm/certificate.ts](backend/src/llm/certificate.ts)

### Step 3: API 라우트 + 프론트엔드 4화면

- **Task 3-1: [Backend] 3개 라우트 구현** `[AGENT 완료]`
  - `POST /persona/generate`, `/chat/turn`, `/certificate/generate`
  - 관련 파일: [backend/src/routes/](backend/src/routes/), [backend/src/index.ts](backend/src/index.ts)
- **Task 3-2: [Frontend] Vite + React + TS 스캐폴딩** `[AGENT 완료]`
  - 입력 → 로딩 → 대화(턴 카운터 포함) → 결과(수료증) 4화면
  - 관련 파일: [frontend/src/screens/](frontend/src/screens/), [frontend/src/App.tsx](frontend/src/App.tsx)
- **Task 3-3: [Frontend] API 클라이언트 + 개발 서버 프록시** `[AGENT 완료]`
  - 관련 파일: [frontend/src/api.ts](frontend/src/api.ts), [frontend/vite.config.ts](frontend/vite.config.ts)

---

## Phase 2: 인프라 결정 (DB / 모델 선정)

### Step 4: Supabase 세션 저장소 전환

*배경: 간편한 관리형 DB로 Supabase 채택. 단, 로컬 실험 편의를 위해 자격증명이 없으면 인메모리로 자동 폴백하도록 설계 — Supabase 프로젝트 세팅 전에도 바로 테스트 가능.*

- **Task 4-1: [DB] Supabase 스키마 작성** `[AGENT 완료]`
  - `mission_talk_sessions` 테이블. `user_key` 컬럼은 앱인토스 익명 식별키 연동 전까지 null
  - 관련 파일: [backend/supabase/schema.sql](backend/supabase/schema.sql)
  - `(USER 액션: Supabase 프로젝트 SQL editor에서 schema.sql 실행 필요 — 아직 미실행, 현재 인메모리로 동작 중)`
- **Task 4-2: [Backend] store.ts를 Supabase 연동 + 인메모리 폴백 구조로 교체** `[AGENT 완료]`
  - 관련 파일: [backend/src/store.ts](backend/src/store.ts), [backend/src/supabase.ts](backend/src/supabase.ts)
  - `(USER 액션: .env에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 입력 시 자동으로 Supabase 사용, 미입력 시 인메모리)`
  - `[TBD]` RLS 미설정 상태 — 서비스 롤 키로 서버에서만 접근하는 전제라 지금은 문제 없지만, 클라이언트 직접 접근하게 되면 RLS 정책 추가 필요

### Step 5: LLM 모델 선정 (Opus 5 → Sonnet 5)

*결정 배경: 롤플레잉 대사 생성 + 구조화 판정 수준은 깊은 추론이 필요한 작업이 아니라고 판단, Sonnet 5로도 지시사항 준수가 충분함. 속도/비용 이점이 명세서 9절 "5분 내 완결" 원칙에도 부합.*

- **Task 5-1: [LLM] `claude-opus-5` → `claude-sonnet-5` 전환** `[AGENT 완료]`
  - 관련 파일: [backend/src/llm/client.ts](backend/src/llm/client.ts)
  - `[TBD]` 수료증 채점(특히 명세서 4절에 언급된 일본어/중국어 존댓말·뉘앙스 판정)의 정확도가 실측상 아쉬우면 그 함수만 `claude-opus-5`로 롤백 검토 ([backend/src/llm/certificate.ts](backend/src/llm/certificate.ts))

---

## Phase 3: 비용 최적화

### Step 6: 프롬프트 캐싱 도입

*배경: `/chat/turn`이 매턴 대화 기록 전체를 하나의 텍스트 블록으로 재구성해서 다시 보내는 구조라, 동일한 페르소나 프롬프트를 매번 새로 계산하고 있었음(`cache_read=0` 확인). 실제 Anthropic multi-turn `messages` 배열 + `cache_control`로 리팩토링.*

- **Task 6-1: [LLM] chat.ts를 flat-text 방식에서 실제 messages 배열 구조로 리팩토링** `[AGENT 완료]`
  - `system` 블록(페르소나+미션 정의, 세션 내내 고정)에 `cache_control: { type: "ephemeral" }` 적용
  - 직전 턴의 마지막 assistant 메시지에도 캐시 경계를 찍어 대화 기록을 증분 캐싱
  - 관련 파일: [backend/src/llm/chat.ts](backend/src/llm/chat.ts)
- **Task 6-2: [검증] 실제 API 호출로 캐시 read/write 실측** `[AGENT 완료]`
  - 턴1: `cache_write=1162` / 턴2~4: `cache_read`가 1,162 → 1,288로 누적 증가, 매턴 새로 계산되는 input은 20~30토큰 수준으로 감소
  - 결론: 턴당 인풋 비용은 절반 이상 절감됨. 단, 캐싱은 output(응답 생성) 비용엔 영향 없음 — 이 앱의 실제 비용 병목은 인풋이 아니라 **가끔 과도하게 길어지는 턴 응답(output)** 쪽 (턴4에서 1,238토큰 관측, 다른 턴은 100~130토큰)
  - 캐시는 Anthropic 서버의 임시 캐시(기본 5분 TTL)이며 우리 DB(Supabase/인메모리) 세션 저장과는 완전히 별개 — 사용자가 5분 넘게 무응답이면 그 턴만 캐시가 만료되어 재적립(기능엔 영향 없음)

---

## Phase 4: TBD 항목 구현

### Step 7: 턴 응답 길이 통제

*배경: Step 6 실측에서 턴4 응답이 1,238토큰까지 폭주하는 걸 발견 (다른 턴은 100~130토큰). 캐싱은 인풋에만 작동하고 이 output 폭주는 못 잡음.*

- **Task 7-1: [LLM] system 프롬프트에 길이 제한 지시 추가 + max_tokens 하드 캡** `[AGENT 완료]`
  - "답변(replyText)은 반드시 1~3문장 이내" 지시 추가, `max_tokens: 2000 → 600`
  - 관련 파일: [backend/src/llm/chat.ts](backend/src/llm/chat.ts)
  - 검증: 자연스러운 4턴 대화로 재테스트 → 전부 1~2문장, 80~150자 수준으로 안정적. (반복적인 동일 입력을 연속으로 넣었을 때 1회 이상한 출력이 나온 적 있으나, 자연스러운 입력에서는 재현 안 됨 — 인위적 테스트 아티팩트로 판단)

### Step 8: 수료증 등급 5단계 확정

*결정: 3단계 → 5단계로 세분화. 채점 기준은 난이도와 무관하게 동일 — 난이도는 상대방(페르소나)이 쓰는 문법/어휘 복잡도에만 영향을 주고, 사용자 문장의 정확성 판단 기준 자체는 낮추거나 높이지 않음.*

- **Task 8-1: [LLM] GRADE_LABELS 5단계로 교체 + 채점 기준 명시** `[AGENT 완료]`
  - 완벽해요 / 잘했어요 / 그럭저럭이에요 / 아쉬워요 / 헉... (좋은 순 → 나쁜 순)
  - system 프롬프트에 단계별 기준 문구 + "난이도 무관 동일 기준 적용" 명시
  - 관련 파일: [backend/src/llm/certificate.ts](backend/src/llm/certificate.ts)
  - 검증: 실제 API 호출로 "완벽해요"/"그럭저럭이에요" 등급 정상 반환 확인

### Step 9: 힌트 기능 (전 난이도 공통, 난이도별 어휘 조정)

*결정: 페르소나 대사에 힌트를 암묵적으로 섞는 기존 방식(Task 2-2의 easy 프롬프트에 있던 "힌트 성격 표현 섞기") 제거하고, 명시적인 힌트 버튼 + 별도 API로 교체.*

- **Task 9-1: [LLM] 힌트 생성 함수** `[AGENT 완료]`
  - 현재 대화 기록 + 미션 목표를 보고, 다음에 하면 좋을 대상 언어 예문(약 2문장) + 한국어 번역을 생성 (정답을 그대로 주지 않고 자연스러운 예시 형태로)
  - 관련 파일: [backend/src/llm/hint.ts](backend/src/llm/hint.ts)
- **Task 9-2: [Backend] POST /chat/hint 라우트** `[AGENT 완료]`
  - 난이도 제한 없음(모든 난이도에서 사용 가능), 세션 종료 상태면 409
  - 관련 파일: [backend/src/routes/hint.ts](backend/src/routes/hint.ts), [backend/src/index.ts](backend/src/index.ts)
- **Task 9-3: [Frontend] 힌트 버튼 + 힌트 박스 UI** `[AGENT 완료]`
  - 채팅 화면 하단에 "💡 힌트" 버튼 항상 노출, 클릭 시 예문+번역을 composer 위 박스에 표시, 메시지 전송하면 초기화
  - 관련 파일: [frontend/src/screens/ChatScreen.tsx](frontend/src/screens/ChatScreen.tsx), [frontend/src/api.ts](frontend/src/api.ts)
  - 검증: 브라우저 + curl로 easy/medium/hard 전부 확인. easy는 "Can I get a large iced americano, please?"처럼 단순하게, hard는 "nothing short of a masterpiece", "off-menu concoction" 같은 관용구 섞인 문장으로 — 난이도별 어휘 수준 차이가 뚜렷하게 나오는 것 확인
- ~~Task 9-2(구): `difficulty !== "easy"`면 403~~ → 사용자가 모든 난이도에서 힌트를 쓸 수 있어야 한다고 판단해 제거. `[frontend/src/App.tsx](frontend/src/App.tsx)`, `ChatScreen.tsx`에서 이제 안 쓰는 `difficulty` prop도 함께 정리

### 메모: 캐릭터 컨셉 (미착수, 코드 변경 없음)

*사용자가 구상 중인 컨셉. 지금은 로그만 남기고 아무것도 구현 안 함 — "이건 컨셉적인 부분이고 나중에 꾸밀 거"라고 명시함.*

- 캐릭터1 "페르소나": 사용자가 만든 설정으로 변신하는 장난꾸러기 캐릭터. 대화(롤플레잉)만 담당 → 지금 코드에서는 `chat.ts` 역할
- 캐릭터2 "도우미": 차분하게 학습을 돕는 캐릭터. 힌트 버튼 눌렀을 때 등장해서 추천 문장 주고, 수료증 채점도 담당 → 지금 코드에서는 `hint.ts` + `certificate.ts` 역할
- 엔지니어링 관점 답변: 멀티스레드/동시성 이슈 아님. 두 캐릭터의 LLM 호출은 이미 원래도 완전히 별개의 순차적 API 요청(메시지 전송 / 힌트 클릭 / 세션 종료 시점에 각각 한 번씩)이라 지금 구조 그대로 캐릭터별 아바타 UI만 얹으면 됨. 백엔드/API 구조 변경 불필요.
- 구체적인 비주얼/이름/등장 연출은 전부 `[TBD]`

### Step 10: 자유입력 가드레일 정책

*결정: 현재 방식(프롬프트 지시로 LLM이 스스로 무난한 상황으로 대체) 유지. 사용자가 "뭐가 나올지 모르는 게 더 재밌다"고 판단, 추가 필터링 레이어 도입 안 함.*

- **Task 10-1: [정책] 결정만 하고 코드 변경 없음** `[AGENT 완료 — 변경사항 없음]`
  - Task 2-2의 기존 가드레일 문구 그대로 유지

---

## Phase 5: 외부 연동 (별도 분리)

*Phase 4까지는 코드/로직만으로 완결되는 작업이었고, 여기부터는 외부 플랫폼(앱인토스)의 SDK 문서·자격증명·샌드박스 접근이 있어야 진행 가능해서 별도 Phase로 분리.*

### Step 11: 앱인토스 개발 도구 세팅 (SDK 문서 검색 + 콘솔 MCP)

*배경: `/plugin marketplace add` 방식은 이 환경(비대화형 CLI 세션)에서 지원 안 됨(`/plugin isn't available in this environment`) — 대신 `ax` CLI(공식 AppsInToss MCP/CLI 툴킷, [toss/apps-in-toss-ax](https://github.com/toss/apps-in-toss-ax))를 npm 글로벌 설치하고, MCP 서버 3개(문서 검색 2개 + 콘솔 작업 1개)를 프로젝트에 등록. 콘솔 MCP는 OAuth 인증이 필요해서 실제 터미널의 인터랙티브 `/mcp` 플로우로 별도 진행.*

- **Task 11-1: [Tooling] ax CLI 글로벌 설치** `[AGENT 완료]`
  - `npm install -g @apps-in-toss/ax` (v0.7.1 설치 확인, `ax search` / `ax get`로 문서 검색·조회 가능)
- **Task 11-2: [Tooling] MCP 서버 2개 등록** `[AGENT 완료]`
  - `apps-in-toss`: `ax mcp` (stdio, AppsInToss 문서/TDS React Native 문서 검색) — 연결 확인
  - `apps-in-toss-docs`: `https://developers-apps-in-toss.toss.im/~gitbook/mcp` (http, GitBook 공식 문서 MCP 엔드포인트) — 연결 확인
  - 관련 파일: [.mcp.json](.mcp.json)
- **Task 11-3: [Tooling] 콘솔 작업용 MCP 등록 + OAuth 인증** `[AGENT 완료]`
  - `apps-in-toss-console`: `https://mcp.toss.im/adapters/apps-in-toss-console/mcp` (http, OAuth)
  - 1차 시도: `url`만 등록 → `/mcp` Authenticate 시도 시 `SDK auth failed: Incompatible auth server: does not support dynamic client registration` 에러 (원인: 이 인증 서버는 Dynamic Client Registration(RFC 7591) 미지원, 고정 client_id 필요)
  - 해결: `.mcp.json`에 `oauth.clientId: "mcp-gateway"` 추가 후 터미널(`claude` CLI, v2.1.238)에서 `/mcp` → Authenticate 재시도 → 성공. [anthropics/claude-code#67258](https://github.com/anthropics/claude-code/issues/67258)에 보고된 버그가 이 버전에서는 재현 안 됨(이미 픽스됐거나 이 서버 조합에서는 안 걸림)
  - 검증: `workspace_overview` 실제 호출 성공 — 워크스페이스 2개 확인(`trabajo00` id 80627, `trabajo` id 80625), 도구 100개+ 로드됨(미니앱 CRUD, 번들 배포, IAP/IAA, 푸시, 대시보드, 리뷰/프로모션 등)
  - 관련 파일: [.mcp.json](.mcp.json)

### Step 12: 앱인토스 규약 전체 감사 (Audit)

*배경: Phase 1~4는 SDK 문서 접근 없이 명세서 텍스트만 보고 개발했음. Step 11에서 공식 문서 MCP가 붙은 뒤, 지금까지의 코드가 앱인토스 규약에 어긋나는지 전수 검사. 근거 문서: [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame), [시작하기](https://developers-apps-in-toss.toss.im/documentation/integration/getting-started), [기존 웹 프로젝트에 SDK 연동하기](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview), [Supabase 연동하기](https://developers-apps-in-toss.toss.im/ai-vibe-coding/integration/supabase)*

#### ✅ 통과 (위반 없음)

- `iframe` 미사용 (SDK 기능 파손 + 심사 반려 사유 1순위) — grep 검사 통과
- `eval` 등 외부 코드 실행 미사용
- `window.location.replace` 등 히스토리 조작 미사용
- SSR 미사용 (Vite CSR) — SSR은 금지, CSR/SSG만 허용
- 프론트엔드에 비밀키 노출 없음 (Anthropic 키·Supabase service_role 키 전부 백엔드 전용)
- 자체 로그인 없음 (미니앱은 토스 로그인만 허용 — 저촉 안 됨)
- 외부 광고 네트워크 미연동 (앱인토스 광고만 허용 — 저촉 안 됨)

#### ❌ 위반 / 미충족 (심각도 순)

- **A-1. `[심사 반려]` 다크 모드 사용** — 체크리스트: *"미니앱 테마는 라이트 모드로 구현돼 있어요."* 현재 [frontend/src/styles.css](frontend/src/styles.css)가 `--bg: #0f1115` 등 완전 다크 팔레트. **전면 라이트 재작업 필요**
- **A-2. `[구조]` 앱인토스 SDK 자체가 미설치** — `@apps-in-toss/web-framework` 없고 `granite.config.ts`도 없음. 현재는 그냥 일반 웹앱이라 미니앱으로 빌드·배포 자체가 불가. `npm install @apps-in-toss/web-framework && npx ait init` 필요, `appName`은 콘솔 등록명과 일치해야 함
- **A-3. `[체크리스트 필수]` 사용자 식별키 미구현** — 체크리스트에 "사용자 식별키 발급" 섹션이 별도로 있음. `getAnonymousKey()` (from `@apps-in-toss/web-framework`, 비게임 카테고리 전용) 사용해야 함. 반환값 `{ type: 'HASH', hash }` / `'INVALID_CATEGORY'` / `'ERROR'` / falsy(구버전) 분기 처리 필요
- **A-4. `[체크리스트 필수]` 재접속 시 데이터 미유지** — *"미니앱을 종료했다가 다시 들어와도 필요한 데이터가 유지돼요"*. 현재 세션이 인메모리 저장 + 식별키 없음이라 앱 끄면 전부 소실. A-3 + Supabase 실제 연결로 같이 해소해야 함
- **B-1. `[기능 파손]` 프로덕션에서 백엔드 호출 불가** — [frontend/src/api.ts](frontend/src/api.ts)가 `/persona/generate` 같은 상대경로 사용. 이건 Vite dev 프록시 전용이라 빌드 후엔 미니앱 도메인(`https://<appName>.web.tossmini.com`)으로 요청이 가서 404. **HTTPS 절대 URL(환경변수)로 교체 필요** (체크리스트: API 통신은 HTTPS만)
- **B-2. `[체크리스트]` 뒤로가기 처리 없음** — *"최초 화면에서 뒤로가기를 누르면 미니앱이 종료돼요"*, *"앱 스킴으로 진입한 뒤, 뒤로가기 버튼이 정상적으로 작동해요"*. 현재 히스토리 조작이 전혀 없어서 대화 중 뒤로가기 시 화면 이동이 아니라 미니앱이 바로 종료됨
- **B-3. `[체크리스트]` 제스처 확대·축소 미차단** — *"지도처럼 꼭 필요한 경우를 제외하고, 제스처 기반 확대·축소 기능은 비활성화돼요"*. [frontend/index.html](frontend/index.html) viewport에 `user-scalable=no`/`maximum-scale=1` 없음
- **B-4. `[체크리스트]` TDS 모달 미사용** — *"사용자 안내나 확인이 필요한 경우 TDS 모달을 사용해요"*. 현재 에러를 빨간 텍스트로만 표시. `@toss/tds-mobile` + `@toss/tds-mobile-ait` 도입 검토 필요(TDS 자체는 선택이지만 이 항목은 체크리스트에 있음)
- **B-5. `[체크리스트]` 내비게이션 바 미대응** — 비게임 내비게이션 바 사용/브랜드 로고 노출/자체 뒤로가기 버튼 중복 금지 등. `granite.config.ts`의 `webViewProps` 설정과 함께 확인 필요
- **C-1. `[보안]` `.gitignore` 없음** — [backend/.env](backend/.env)에 실제 Anthropic API 키가 평문으로 있음. 현재 git 저장소가 아니라 유출은 없지만, `git init` 후 `git add .` 하는 순간 키가 커밋됨. **git 시작 전 반드시 생성**
- **C-2. `[보안]` Supabase RLS 비활성** — [backend/supabase/schema.sql](backend/supabase/schema.sql)에서 의도적으로 RLS를 꺼둠. 현재는 백엔드가 service_role 키로만 접근하는 구조라 즉각적 위험은 낮지만, 앱인토스 Supabase 가이드는 배포 전 RLS 활성화를 명시적으로 요구. 클라이언트에서 직접 Supabase를 붙이게 되면 즉시 치명적

#### ⚠️ 추가 확인 필요 (판단 보류)

- **명세서의 "수료증 이미지 공유" 실현 가능성** — 확인된 공유 API는 `share({ message })`(텍스트)와 `getTossShareLink(url, ogImageUrl?)`. 이미지 파일 자체를 공유 시트에 올리는 게 가능한지 미확인. 불가하면 "수료증 링크 + OG 이미지" 방식으로 명세 수정 필요
- **응답 지연** — 체크리스트의 *"인터랙션 반응이 2초 이상 지연되지 않아요"*. 현재 페르소나 생성 3~6초, 턴 응답 2~4초. 로딩 화면이 있어서 "무반응"은 아니지만 심사 해석 확인 필요. 스트리밍 도입 시 체감 지연 개선 가능
- **공유 스킴** — 구현 시 `intoss-private://`(QR 테스트용)가 아니라 `intoss://`를 써야 함

### Step 13: 감사 후속 조치 (Remediation) — A-1~A-4, B-1, C-1 해소

*Step 12 감사에서 나온 항목 중 심각도 높은 것부터 순서대로(.gitignore → A-2 → A-3/A-4 → B-1 → A-1) 처리. 전부 실제 API 호출 + 브라우저 조작으로 검증 완료.*

- **Task 13-1: [보안] `.gitignore` 추가 (C-1)** `[AGENT 완료]`
  - 프로젝트 루트에 신설, `.env`/`node_modules`/`dist`/`*.ait` 등 포함
  - 관련 파일: [.gitignore](.gitignore)

- **Task 13-2: [Frontend] 앱인토스 SDK 설치 + 빌드 파이프라인 연결 (A-2)** `[AGENT 완료]`
  - `@apps-in-toss/web-framework`, `@apps-in-toss/devtools` 설치
  - `apps-in-toss.config.ts` 작성 — `appName: "mission-talk"`(플레이스홀더, 콘솔 등록 시 교체 필요), `navigationBar: { theme: "light" }`
  - `vite.config.ts`에 `aitDevtools.vite()` 플러그인 연결(개발 중 SDK mock + 우측 상단 AIT 패널 자동 주입)
  - `package.json`의 `build` 스크립트에 `ait build` 추가, `deploy`(`ait deploy`) 스크립트 추가
  - 관련 파일: [frontend/apps-in-toss.config.ts](frontend/apps-in-toss.config.ts), [frontend/vite.config.ts](frontend/vite.config.ts), [frontend/package.json](frontend/package.json)
  - `[중요 발견]` 문서 사이트(GitBook)는 `granite.config.ts`(2.x 구버전 스키마)를 보여주는데, 실제 설치되는 최신 버전(3.0.5)은 `apps-in-toss.config.ts`를 씀 — 스키마도 다름(`brand.displayName`/`icon` 없음, `navigationBar`/`webView` 옵션 새로 생김). 설치된 패키지의 `.d.ts`에서 직접 확인한 스키마를 신뢰함 (`node_modules/@apps-in-toss/web-framework/dist/config.d.ts`)
  - 검증: `npx vite build` + `npx ait build` 둘 다 실제로 `.ait` 번들 생성까지 성공
  - `(완료)`: Step 15에서 콘솔에 실제 등록함 — appName `mission-talk`이 플레이스홀더가 아니라 실제 등록값으로 확정됨

- **Task 13-3: [Full-stack] 사용자 식별키 연동 + 재접속 시 데이터 유지 (A-3, A-4)** `[AGENT 완료]`
  - **식별키**: `User.getAnonymousKey()` 연동. `IdentityProvider` 인터페이스 + `TossAnonymousKeyProvider`(실제 SDK) / `LocalDevIdentityProvider`(로컬 브라우저 폴백, `localStorage` UUID)를 순서대로 시도하는 `FallbackIdentityProvider`로 구성 — 실행 환경과 무관하게 항상 동일한 인터페이스로 사용 (Chain-of-Responsibility 스타일 폴백 패턴)
    - 관련 파일: [frontend/src/lib/identity.ts](frontend/src/lib/identity.ts)
    - `[중요 발견]` 문서의 `getAnonymousKey()`(최상위 함수)는 v3.0.5에서 **deprecated** — `User.getAnonymousKey()`를 써야 함. 반환 계약도 다름: 구버전은 `'INVALID_CATEGORY' | 'ERROR' | undefined | {hash}` 유니언, 신버전은 성공 시 `{hash}` 직접 resolve, 실패 시 `throw`
    - `[검증]` 실제 SDK 소스(`assertWebViewEnvironment`)를 직접 읽어서, WebView 밖에서 호출하면 **즉시 reject**(행 걸리지 않음)하는 것 확인 — 폴백 체인이 멈추지 않음이 보장됨
    - `[검증]` 로컬 dev에서는 `@apps-in-toss/devtools`의 mock이 `User.getAnonymousKey()`를 가로채 고정 가짜 해시(`mock-anon-hash-xyz789`)를 반환하는 것 확인 (`window.__ait._state.auth.anonymousKeyHash`) — `LocalDevIdentityProvider`는 mock이 없는 환경(예: mock 꺼진 프로덕션 빌드를 브라우저에서 직접 여는 경우)을 위한 2차 안전망으로 존재
  - **데이터 유지**: 세션 활성 상태(`sessionId`)만 `localStorage`에 저장 — 앱 재진입 시 `GET /chat/session/:id`로 서버의 실제 최신 상태(대화 기록/턴수/종료여부/수료증)를 다시 받아와 화면을 재구성. 대화 내용 자체를 클라이언트에 캐싱하지 않아 서버 상태와 어긋날 일이 없음
    - 새 백엔드 엔드포인트: `GET /chat/session/:sessionId`
    - 수료증도 세션에 영구 저장(`certificate` 컬럼) — 재조회 시 LLM 재호출 없이 캐시된 결과 반환(`POST /certificate/generate`가 idempotent해짐)
    - 관련 파일: [backend/src/routes/session.ts](backend/src/routes/session.ts), [backend/src/store.ts](backend/src/store.ts) (`saveCertificate` 추가), [backend/supabase/schema.sql](backend/supabase/schema.sql) (`certificate jsonb` 컬럼 추가), [frontend/src/lib/sessionPersistence.ts](frontend/src/lib/sessionPersistence.ts), [frontend/src/App.tsx](frontend/src/App.tsx) (마운트 시 복원 로직), [frontend/src/screens/ChatScreen.tsx](frontend/src/screens/ChatScreen.tsx) (`initialTurns`로 메시지/턴수 재구성)
  - `user_key` 컬럼에 실제로 값이 채워지도록 `/persona/generate`가 `userKey`를 받아 세션 생성 시 저장하도록 변경 (Phase 2 Step 4에서 만들어두고 비워뒀던 컬럼을 이번에 실제로 채움)
  - 검증: 브라우저에서 1턴 진행 → 새로고침 → 대화·턴카운터 그대로 복원 확인. 미션 클리어까지 진행 → 새로고침 → 수료증 화면이 재채점 없이 그대로 복원 확인

- **Task 13-4: [Frontend] 프로덕션 API 베이스 URL (B-1)** `[AGENT 완료]`
  - `VITE_API_BASE_URL` 환경변수 도입 — 비어있으면(로컬 dev) 기존처럼 상대경로+Vite 프록시, 값이 있으면 그 절대 URL로 모든 API 호출
  - 관련 파일: [frontend/src/api.ts](frontend/src/api.ts), [frontend/src/vite-env.d.ts](frontend/src/vite-env.d.ts), [frontend/.env.example](frontend/.env.example)
  - 검증: `VITE_API_BASE_URL` 설정 후 빌드 → 산출물 JS에 해당 URL이 실제로 박히는 것 확인. 미설정 상태에서 로컬 dev 서버는 기존과 동일하게 동작하는 것도 재확인(회귀 없음)
  - `(USER 액션: 실제 배포 시 `frontend/.env`에 배포된 백엔드의 HTTPS URL을 반드시 채울 것)`

- **Task 13-5: [Frontend] 라이트 모드 전환 (A-1)** `[AGENT 완료]`
  - 전체 UI가 CSS 커스텀 프로퍼티(디자인 토큰: `--bg`/`--surface`/`--text`/`--text-dim`/`--border`/`--primary`) 위에 짜여 있어서, `:root` 값 6개만 다크→라이트로 교체하고 나머지 코드는 무수정
  - 관련 파일: [frontend/src/styles.css](frontend/src/styles.css)
  - 검증: 입력/로딩/채팅(힌트 박스 포함)/결과 화면 4개 전부 브라우저 스크린샷으로 대비·가독성 확인

### Step 14: 감사 후속 조치 2차 — B-2~B-5, Share SDK

*Step 13에서 남겨둔 B-2(뒤로가기)/B-3(확대축소)/B-4(TDS 모달)/B-5(내비게이션 바)/Share SDK 처리.*

#### ⚠️ 중요 발견: `@toss/tds-mobile` 패키지에서 의심스러운 난독화 코드 — 사용 보류

- B-4(TDS 모달) 작업 중 `@toss/tds-mobile`(설치 시점 최신 버전 2.5.1)을 설치하자 `ConfirmModal`이 `Invalid hook call` / `Cannot read properties of null (reading 'useRef')`로 즉시 크래시함
- 원인 조사 중 `node_modules/@toss/tds-mobile/dist/esm/index.js` **최상단**에서 다음과 같은 코드를 발견함:
  - `console.log`를 조용히 무력화(`_cqk["log"]=function(){}`)하는 즉시실행함수
  - `window`/`document`의 속성을 리터럴 문자열("location", "hostname", "domain" 등) 없이 **글자 단위 charCode 비교**로 스캔해서 찾아내는 코드(정적 문자열 검색으로 안 걸리게 하려는 의도로 보임)
  - 찾아낸 값(추정: `location.hostname`)을 해시(`_hqz` — 문자열 해시 함수)한 뒤, **하드코딩된 매직넘버 배열**(`_dbh=[[1,98689,...], ...]`, 수십 개 항목)과 대조하는 로직
  - 이 패턴은 전형적인 **도메인 화이트리스트 라이선스 게이트**(허가된 토스 도메인이 아니면 조용히 기능을 죽이거나 저하시키는 방식) 구조와 일치함 — 우리가 겪은 크래시/`SafeAreaInsets` 에러들이 이 게이트의 부작용일 가능성이 높음
- **판단**: 이게 토스가 의도적으로 심어둔 (다소 공격적인) 라이선스 보호 장치인지, 아니면 패키지 자체가 손상/변조된 것인지 코드만으로는 확정할 수 없음. 둘 중 어느 쪽이든 **역공학하거나 우회 시도를 하지 않고 즉시 중단**하는 게 맞다고 판단해서:
  - `@toss/tds-mobile`, `@toss/tds-mobile-ait`, `@emotion/react` 전부 제거 (`npm uninstall`)
  - `main.tsx`의 `TDSMobileAITProvider` 래핑 되돌림
  - **`(USER 액션 필요)`**: TDS를 실제로 써야 한다면, 반드시 앱인토스 공식 채널(개발자 문의/Slack 등)을 통해 "이 난독화가 의도된 라이선스 체크가 맞는지, 로컬 개발 도메인(`localhost`)에서도 정상 동작하려면 어떻게 해야 하는지" 확인 필요. 확인 전까지는 설치하지 않는 걸 권장
- **추가 확인** ([design/components](https://developers-apps-in-toss.toss.im/design/components), [Figma UI Kit 라이선스](https://developers-apps-in-toss.toss.im/design/prepare/figma-ui-license)): 이 두 문서는 **Figma 디자인 파일**의 라이선스지 npm 코드 패키지(`@toss/tds-mobile`) 자체에 대한 문서는 아니라서, 위 난독화 코드를 직접 확인/설명해주진 않음. 다만 Figma 키트 라이선스가 "앱인토스용 앱 개발 외 다른 프로젝트에 사용 금지, 재배포 금지, 위반 시 라이선스 즉시 종료"를 명시하고 있어 — 토스가 TDS 전반을 "실제 등록된 앱인토스 파트너사 전용"으로 취급한다는 정황과는 일치함(= 로컬 브라우저에서 깨지는 게 의도된 동작일 가능성을 높여줌). 다만 "npm 패키지가 코드 레벨에서 이런 방식으로 도메인을 검사한다"는 공식 confirmation은 아님 — 여전히 `[TBD]`
- 공식 컴포넌트 쇼케이스(핵심 11개: Badge/Border/BottomCTA/Button/Asset/ListRow/ListHeader/Navigation/Paragraph/Tab/Top)에는 **Modal이 없음** — 패키지 타입 정의상 존재는 하지만 비주류 컴포넌트로 보임

- **Task 14-1: [Frontend] TDS 없이 확인 모달 자체 구현 (B-4 대체)** `[AGENT 완료]`
  - `Modal`/`Button`(TDS) 대신, 기존 `styles.css` 디자인 토큰만으로 바텀시트형 확인 모달 구현
  - 관련 파일: [frontend/src/components/ConfirmModal.tsx](frontend/src/components/ConfirmModal.tsx), [frontend/src/styles.css](frontend/src/styles.css)(`.modal-*` 클래스)
  - 검증: 브라우저에서 실제 렌더링 + 버튼(계속하기/나가기) 클릭 동작 확인

- **Task 14-2: [Frontend] 뒤로가기 처리 (B-2)** `[AGENT 완료 — 실기기/실WebView 검증은 못 함]`
  - `graniteEvent.addEventListener('backEvent', ...)`로 네이티브 뒤로가기 버튼을 가로챔(등록하는 순간 기본 동작은 막힘)
  - 화면별 동작: **input**(최초 화면) → `Screen.close()`로 미니앱 종료 / **chat**(미션 진행 중) → Task 14-1의 확인 모달 표시 후 나가기 선택 시에만 이탈 / **restoring·loading·result** → 잃을 진행상황이 없으니 바로 입력 화면으로
  - `stageRef`로 최신 stage를 참조(리스너는 마운트 시 1회만 등록하므로 클로저 고착 방지), `activeRequestRef`로 "로딩 중 뒤로가기 → 그 후 원래 요청이 뒤늦게 성공" 경쟁 상태 방지
  - `[중요 발견]` 문서의 `getTossShareLink`/최상위 `share`처럼, 여기서도 `AppsInToss.registerApp`(2.x/RN 문서)에 나온 뒤로가기 처리 방식과 실제 WebView 3.x API(`graniteEvent`+`Screen.close`)가 다름 — 실제 설치 패키지 타입에서 직접 확인한 API를 채택
  - 관련 파일: [frontend/src/App.tsx](frontend/src/App.tsx)
  - 검증: 실제 하드웨어/네이티브 뒤로가기 이벤트는 실기기·실 토스앱에서만 발생해서 이 환경(브라우저)에서 트리거는 못 시켜봄 — SDK 타입 정의와 소스 코드로 API 정합성만 확인, `showLeaveConfirm` 상태를 임시로 강제 `true`로 바꿔서 모달 렌더링/버튼 동작만 별도로 시각 검증(검증 후 원복)
  - `[TBD]` iOS 스와이프 뒤로가기 제스처는 `backEvent`와 별개 경로일 수 있음(`Screen.setIosSwipeBack`) — 필요하면 추가 확인

- **Task 14-3: [Frontend] 제스처 확대·축소 차단 (B-3)** `[AGENT 완료]`
  - `viewport` meta에 `maximum-scale=1.0, user-scalable=no` 추가
  - 관련 파일: [frontend/index.html](frontend/index.html)

- **Task 14-4: [Frontend] 내비게이션 바 대응 (B-5)** `[AGENT 완료 — 설정 레벨]`
  - Task 13-2에서 이미 작성한 `apps-in-toss.config.ts`의 `navigationBar: { withBackButton: true, withTitle: true, theme: "light" }`가 이 항목을 담당 — 별도 코드 추가 없이 설정으로 해결되는 부분이라 Step 13에서 이미 완료돼 있었음, 이번에 재확인만 함
  - 자체 뒤로가기 버튼을 화면에 그리지 않고 있어서 "토스 내비게이션 바 뒤로가기와 자체 구현 뒤로가기가 동시에 보이면 안 됨" 항목도 저촉 없음
  - `[TBD]` "브랜드 로고와 미니앱 이름이 내비게이션바에 표시" 항목은 실제 콘솔에 미니앱 등록(로고 업로드 등) 후에만 육안 확인 가능 (Task 13-2의 USER 액션과 동일 전제조건)

- **Task 14-5: [Frontend] Share SDK 연동** `[AGENT 완료]`
  - `Share.sendMessage({ message })` 연동. `identity.ts`와 동일한 폴백 체인 패턴(`ShareProvider` 인터페이스) 적용 — 앱인토스 WebView 실패 시 Web Share API, 그마저 없으면 클립보드 복사로 순서대로 폴백
  - Web Share API의 "사용자가 공유 시트를 직접 닫음"(`AbortError`)은 실패가 아니라 의도된 취소로 간주해 다음 폴백으로 안 넘어가도록 구분 처리
  - 클립보드 폴백은 네이티브 UI가 없어서 별도 안내 문구(`"클립보드에 복사했어요"`) 노출
  - 관련 파일: [frontend/src/lib/share.ts](frontend/src/lib/share.ts), [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx)
  - `[중요 발견]` 문서의 최상위 `share`/`getTossShareLink` 함수도 v3.0.5에서 **deprecated** — `Share.sendMessage`/`Share.createLink`가 현행 API (동일한 문서-실패키지 스키마 드리프트 패턴, Task 13-3의 `getAnonymousKey`와 동일 사례)
  - 검증: 브라우저에서 실제 클릭 → devtools mock이 `[@apps-in-toss/devtools] share: ...` 로그로 정확한 공유 메시지를 가로채는 것 콘솔에서 확인(mock이 성공 처리해서 실제로는 Web Share/클립보드 폴백까지는 못 갔음 — 정상적인 폴백 체인 동작)

#### 남은 것

- C-2 Supabase RLS — 결정 유지(서버 전용 접근이라 비활성 상태가 맞다고 재확인, Step 12 참고)
- TDS(B-4 원래 요구사항인 "TDS 모달") — 위 보안 이슈로 보류. 자체 구현 모달로 기능은 대체했지만 엄밀히는 "TDS를 쓴다"는 원 요구사항 자체는 미충족
- ⚠️ 판단 보류 3건(수료증 이미지 공유 가능 여부, 응답 지연, 공유 스킴)도 그대로 미해결
- 뒤로가기 실기기 검증 — 실제 토스 앱/샌드박스 앱에서 QR 테스트 필요

### Step 15: 콘솔 미니앱 등록

*배경: `apps-in-toss.config.ts`의 `appName: "mission-talk"`가 아직 플레이스홀더였음(Task 13-2). 실제 콘솔 등록이 있어야 내비게이션 바 브랜드 표시(B-5), 실기기 QR 테스트, 로고 등이 전부 풀림. 콘솔 MCP(`miniapp_create`)로 실제 등록 가능하지만 이건 진짜 심사 요청이 걸리는 액션(승인/반려 결과가 이메일로 옴, 영업일 약 2일)이라 사용자 확인 먼저 받음.*

- **Task 15-1: [Infra] 등록 내용 초안 확정** `[AGENT 완료]`
  - 워크스페이스: **trabajo** (id 80625) — trabajo00(80627)은 안 씀
  - 카테고리: **생활 > 교육** (categoryId 3800, subCategoryId 82) — "생활 > AI"(3830/90)도 후보였으나 사용자가 교육으로 확정
  - 확정된 필드값:

    | 필드 | 값 |
    |---|---|
    | title (한글 앱 이름) | 미션톡 |
    | titleEn | Mission Talk |
    | appName | mission-talk (`apps-in-toss.config.ts`와 동일 — 등록되면 그대로 유지, 플레이스홀더 아님) |
    | description (부제) | AI와 외국어 롤플레잉 회화 연습 |
    | detailDescription | 언어/상대방 역할/성격/난이도를 입력하면 AI가 롤플레잉 캐릭터와 미션을 자동 생성합니다. 최대 7턴 동안 채팅으로 대화하며 미션을 클리어하고, '하' 난이도에서는 힌트 버튼으로 예문을 확인할 수 있습니다. 완료 후 턴별 문장 평가 결과를 확인하고 공유할 수 있습니다. |
    | appType | NON_GAME |

- **Task 15-2: [Design] 로고 제작 + 업로드 + 실제 제출** `[AGENT 완료]`
  - 1차 시안(흰 배경 + "Mission Talk" 텍스트, 1080×1350)은 정사각형도 아니고 아이콘보다는 워드마크에 가까워서 보류 → 사용자가 **아케이드/픽셀아트 톤으로 재제작**: 말풍선(톡) + 체크마크(미션 클리어) 조합, 864×864, 배경색 `#4f7cff`(앱 primary 컬러와 동일) — "미션톡"이라는 이름 자체를 아이콘 하나로 표현하면서 앱 UI와 색이 자연스럽게 이어짐
  - `sips`로 600×600 리사이즈(`assets/mission_talk_logo_600.png`), `image_upload_url` → S3 PUT 업로드 → `miniApp.iconUri`에 반영해서 `miniapp_create` 한 번에 제출(로고 누락 상태로 나눠 보내면 반려된다는 안내에 따름)
  - 관련 파일: [assets/mission_talk_logo.png](assets/mission_talk_logo.png)(원본), [assets/mission_talk_logo_600.png](assets/mission_talk_logo_600.png)(제출용)
  - **결과**: `miniAppId 68657`, `reviewState: IN_REVIEW` (영업일 약 2일 후 이메일 통보), 서비스 링크 `intoss://mission-talk`(출시 승인 전엔 안 열림), 콘솔 홈: https://apps-in-toss.toss.im/workspace/80625/mini-app/68657/home
  - `[TBD]` 심사 결과 대기 중 — 승인/반려 여부에 따라 후속 조치 필요(반려 시 `miniapp_meta_status`의 `rejectedMessage`로 사유 확인 후 대응)

---

### Step 16: 백엔드 배포

*배경: 지금 백엔드는 `localhost:3001`에서만 떠 있음. 실제 폰으로 QR 테스트하거나 콘솔 심사에 실제로 통과해서 출시하려면, 실제 기기가 인터넷으로 접근 가능한 HTTPS 주소가 있어야 함(Task 13-4에서 만든 `VITE_API_BASE_URL`을 채울 값이기도 함). 플랫폼은 사용자가 **Render**(git 연동 자동배포, 무료 티어) 선택.*

- **Task 16-1: [Infra] git 저장소 초기화 + GitHub push** `[AGENT 완료]`
  - 프로젝트가 git 저장소가 아니었어서 `git init` + 첫 커밋(45개 파일) + push
  - `backend/.env`(실제 API 키 포함)가 `.gitignore`로 정상 제외되는 것 커밋 전에 재확인함
  - `backend/tsconfig.tsbuildinfo`, `frontend/tsconfig.tsbuildinfo`(빌드 캐시)는 커밋 대상에서 제외하고 `.gitignore`에 `*.tsbuildinfo` 추가
  - GitHub 저장소는 사용자가 직접 생성: [github.com/oghdy/Mission_Talk](https://github.com/oghdy/Mission_Talk)
  - `(USER 액션 완료)`: `gh auth login`으로 GitHub 인증 — 이건 사용자가 직접 브라우저로 로그인해야 하는 부분이라 대신 못 함
  - 참고: 커밋 작성자가 `하도윤 <hadohadopapi@hadoyun-ui-MacBookAir.local>`로 자동 설정됨(로컬 유저명/호스트명 기반) — 실제 GitHub 계정 이메일과 다를 수 있음, 필요하면 `git config --global user.email`로 직접 수정
- **Task 16-2: [Backend] 배포용 빌드 검증** `[AGENT 완료]`
  - `npm run build`(tsc) → `dist/` 생성 → `PORT` 환경변수로 재정의해서 `npm start` 실행까지 실제로 확인 (Render는 자체 `PORT`를 주입하는데, `index.ts`가 이미 `process.env.PORT` 우선 사용하도록 되어 있어서 별도 수정 불필요)
  - 관련 파일: [backend/package.json](backend/package.json)(`build`/`start` 스크립트 기존에 이미 있었음)
- **Task 16-3: [Infra] Render 웹서비스 생성** `[AGENT 완료 — USER가 대시보드에서 생성]`
  - Root Directory `backend`, Build `npm install && npm run build`(Render 기본값 `npm install; npm run build`도 동일 효과라 그대로 둠), Start `npm start`, env: `ANTHROPIC_API_KEY`만 우선 등록(Supabase는 아직 없어서 인메모리 유지)
  - 배포 주소: **https://mission-talk.onrender.com**
  - 검증: `/health`, `/persona/generate` curl로 실제 200 확인(첫 호출은 무료 티어 콜드스타트 포함 12초)

#### ⚠️ 중요 발견 2: 프로덕션 빌드에서 앱 전체가 하얗게 죽는 버그 발견 + 수정

- Render 배포 검증 겸, `VITE_API_BASE_URL`을 실제 배포 URL로 채운 **프로덕션 빌드**(`vite build`)를 `vite preview`로 띄워서 브라우저로 열어보니 **완전히 빈 흰 화면**이 뜸
- 콘솔 확인 결과: `Error: apps-in-toss 웹뷰 환경이 아니에요. 토스 앱 안에서만 호출할 수 있어요.` — Task 14-2에서 추가한 `graniteEvent.addEventListener('backEvent', ...)` 호출이 원인
  - `npm run dev`(로컬 개발)에서는 `@apps-in-toss/devtools`의 mock이 이 호출을 가로채서 문제가 안 드러났음
  - 하지만 devtools mock은 **프로덕션 빌드에서 기본적으로 꺼짐** — 그 상태에서는 실제 SDK 구현이 그대로 실행되고, WebView가 아니면 동기적으로 `throw`함
  - 리액트는 에러 바운더리가 없으면 렌더링 중 발생한 에러 하나로 **트리 전체를 unmount**함 — 그래서 앱 전체가 백지가 됨. 이건 콘솔 개발 중엔 절대 안 드러나고 실제 빌드로만 재현되는 종류의 버그라, 배포 검증을 안 했으면 그대로 심사에 냈다가 반려됐을 수 있음
- **수정**: `graniteEvent.addEventListener` 호출을 `try/catch`로 감쌈 — WebView가 아니면 경고 로그만 남기고 조용히 리스너 등록을 건너뜀 (identity.ts/share.ts와 동일한 방어 패턴)
- 관련 파일: [frontend/src/App.tsx](frontend/src/App.tsx)
- 검증: 수정 후 다시 `VITE_API_BASE_URL` 채워서 프로덕션 빌드 → `vite preview`로 브라우저 확인 → 정상 렌더링, 콘솔 에러 없음. 그 상태로 실제 배포된 Render 백엔드와 미션 시작→턴 진행→클리어→수료증까지 **엔드투엔드 전체 플로우 재검증 완료**
- `[교훈]` 앱인토스 SDK를 쓰는 함수는 전부 이렇게 "실제 WebView 밖에서 동기적으로 throw하는지" 소스 레벨로 확인하고 방어적으로 감싸야 함 — devtools mock이 있는 dev 모드만 보고 "됐다"고 판단하면 안 됨

---

### Step 17: Supabase 실제 연결 — 프로젝트 생성부터 스키마 적용까지

*배경: Phase 2 Step 4에서 Supabase 연동 코드는 다 짜놨지만 자격증명이 없어서 계속 인메모리 폴백으로 돌고 있었음(서버 재시작하면 데이터 소실). `supabase` CLI로 로그인(사용자 직접) → 신규 프로젝트 생성 → 스키마 적용까지 전부 CLI/psql로 진행.*

- **Task 17-1: [Infra] Supabase CLI 설치 + 로그인** `[AGENT 완료 / USER 로그인 완료]`
  - `brew install supabase/tap/supabase`가 Xcode Command Line Tools 버전 문제로 실패 → GitHub 릴리즈(`supabase_2.115.0_darwin_arm64.tar.gz`)에서 바이너리 직접 받아 `/opt/homebrew/bin/supabase`에 설치
  - `(USER 액션 완료)`: `supabase login`으로 브라우저 인증 — 이 계정에 기존 프로젝트 2개(`only_friends`, `oghdy's Project`)가 이미 있는 걸 확인했고, 둘 다 안 건드리고 새 프로젝트로 진행
- **Task 17-2: [Infra] 신규 Supabase 프로젝트 생성** `[AGENT 완료]`
  - `supabase orgs list`로 조직 확인(`oghdy`, id `yefzyquvjohicluemuds`) 후 `supabase projects create`로 생성
  - 이름 `mission-talk`, 리전 `ap-northeast-2`(서울 — 기존 두 프로젝트와 동일 리전, 국내 사용자 레이턴시 고려), DB 비밀번호는 `openssl rand`로 32자 랜덤 생성
  - 결과: project ref `ehugyuhdziiqnzrxibfo`, `https://ehugyuhdziiqnzrxibfo.supabase.co`, 생성 즉시 `ACTIVE_HEALTHY`
  - `supabase projects api-keys`로 키 조회 — legacy `service_role` JWT(전체 값 노출됨)를 백엔드용으로 채택. 신형 `sb_secret_...` 키는 CLI가 보안상 마스킹해서 전체값을 못 받아옴
- **Task 17-3: [DB] 스키마 적용** `[AGENT 완료]`
  - `db.<ref>.supabase.co:5432` 직접 연결은 DNS resolve 실패(IPv4 직결 미지원 추정) → **Supavisor 풀러**(`aws-0-ap-northeast-2.pooler.supabase.com:5432`, user `postgres.<ref>`)로 전환하니 정상 연결
  - `psql -f backend/supabase/schema.sql`로 `mission_talk_sessions` 테이블 + `user_key` 인덱스 생성, `\d`로 컬럼/인덱스 스키마 그대로 반영된 것 확인
  - 관련 파일: [backend/supabase/schema.sql](backend/supabase/schema.sql) (내용 변경 없음, 이번엔 실제 DB에 최초 적용)
- **Task 17-4: [Backend] 자격증명 반영 + 실동작 검증** `[AGENT 완료]`
  - `backend/.env`에 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 채움, 서버 재시작 → "인메모리로 저장" 경고 로그 더 이상 안 뜨는 것으로 1차 확인
  - `/persona/generate` 실제 호출 → 응답으로 받은 `sessionId`를 `psql`로 직접 조회해서 **실제 Postgres 테이블에 정확한 데이터(userKey 포함)가 들어간 것**까지 확인
  - 검증용으로 넣은 테스트 행은 확인 후 삭제
  - `(USER 액션 없음 — 참고)`: DB 비밀번호는 로컬 스크래치패드에만 저장하고 채팅엔 노출 안 함. 나중에 Supabase 대시보드에서 직접 psql/마이그레이션 도구를 쓰고 싶으면 **Settings → Database → Reset database password**로 새로 발급받아 쓰면 됨
- **Task 17-5: [Infra] Render 배포본에도 자격증명 반영** `[AGENT 완료 — USER가 Render 대시보드에서 env 추가]`
  - `(USER 액션 완료)`: Render 서비스 Environment에 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 추가 → 자동 재배포
  - 검증: 로컬 `backend/.env`의 자격증명으로 Supabase REST API(PostgREST, `<SUPABASE_URL>/rest/v1/mission_talk_sessions`)를 직접 호출해서 확인 — DB 비밀번호 없이도 service_role 키만으로 조회 가능해서 이 방법 사용. 실제 배포 URL(`https://mission-talk.onrender.com`)로 `/persona/generate` 호출 → 그 응답의 `sessionId`가 Supabase 테이블에 그대로 들어있는 것 확인. 검증용 테스트 행은 REST API로 삭제

---

## Phase 6: 사용자 직접 QA (배포 전 점검)

*배경: 로컬에서 사용자가 직접 여러 번 플레이해보면서 발견한 이슈들을 즉시 수정하는 라운드. 앱인토스 규약이 아니라 순수 제품/버그 품질 이슈라 Phase 5(외부 연동)와 분리.*

### Step 18: 1차 수정 (사용자 리포트 3건 + 작업 중 발견한 크래시 1건)

- **Task 18-1: [Frontend] "아무거나 골라줘" 랜덤 채우기 버튼** `[AGENT 완료]`
  - 상대방/성격을 직접 고민하기 귀찮은 사용자를 위해, 순수 역할 15종 × 성격 11종 풀에서 각각 독립적으로 랜덤 선택해 채워주는 버튼 추가 (조합 다양성을 위해 역할·성격 쌍으로 안 묶고 따로 뽑음)
  - 관련 파일: [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)(`.random-fill-button`)
  - 검증: 브라우저에서 클릭 → "미용실 디자이너" / "다정함"처럼 실제로 채워지는 것 확인
- **Task 18-2: [Frontend] "상대방" placeholder가 성격을 이미 포함하고 있던 문제** `[AGENT 완료]`
  - 기존 `예: 까칠한 카페 직원`은 "까칠한"이 성격 형용사라 상대방/성격 두 입력란의 역할이 헷갈림 → `예: 카페 직원`으로 수정, 랜덤 채우기 풀(Task 18-1)도 역할에서 성격 형용사 전부 배제
  - 관련 파일: [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx)
- **Task 18-3: [LLM] 수료증 피드백(comment)이 학습 언어로 나오던 문제** `[AGENT 완료]`
  - 스페인어로 미션 진행 후 수료증을 보면 개선 제안(comment)이 스페인어로 나옴 — 한국 사용자가 읽는 피드백인데 학습 언어와 설명 언어를 혼동한 것
  - 시스템 프롬프트에 "comment의 설명 문장은 항상 한국어로, 고친 문장 예시만 대상 언어로 인용" 명시 + Zod 필드 설명도 동일하게 수정
  - 관련 파일: [backend/src/llm/certificate.ts](backend/src/llm/certificate.ts)
  - 검증: 일부러 어색한 스페인어(`Yo querer un cafe grande...`)로 실제 호출 → `"동사 활용이 틀렸어요. 'querer'는 원형이라..."` 처럼 설명은 한국어, 고친 문장(`'Quiero un café grande, por favor.'`)만 스페인어로 인용되는 것 확인
- **Task 18-4: `[버그, 작업 중 발견]` `/chat/turn` JSON 파싱 크래시 (max_tokens 부족)** `[AGENT 완료]`
  - Task 18-3 검증 중 스페인어 대화에서 `AnthropicError: Failed to parse structured output ... Unexpected end of JSON input` 발생, 프론트는 응답을 영영 못 받고 "..." 상태로 멈춤(타임아웃/에러 처리 없이 그냥 무한 대기)
  - 원인: Step 7에서 output 폭주 방지용으로 `max_tokens`를 600으로 좁혀뒀는데, Sonnet 5는 기본적으로 적응형 thinking이 켜져 있어서(생략하면 자동 adaptive) thinking 토큰도 같은 `max_tokens` 예산을 나눠 씀. 스페인어처럼 사고 과정이 길어지는 케이스에서 600으로는 부족해 JSON이 채 안 끝나고 잘림
  - 수정: `max_tokens`를 2000으로 다시 올림 — 응답 길이 통제는 이미 system 프롬프트의 "1~3문장" 지시가 담당하고 있어서 실제 답변이 길어지진 않음, `max_tokens`는 순수 안전 여유분 용도로만 씀
  - 관련 파일: [backend/src/llm/chat.ts](backend/src/llm/chat.ts)
  - 검증: 동일하게 실패했던 스페인어 문장으로 재호출 → 정상 응답 + `missionComplete: true`까지 확인
  - `[정정]` 처음엔 "502를 받고도 프론트가 에러 표시 없이 무한 로딩된다"고 오판했으나, 실제로는 테스트 중이던 백엔드가 코드 수정으로 `tsx watch`에 의해 재시작되면서 요청이 끊긴 것이 원인 — `ChatScreen.tsx`의 `sendTurn` 호출은 이미 try/catch로 에러를 잡아 화면에 표시함
  - `[TBD]` 다만 이 과정에서 진짜 갭 하나를 발견함: [frontend/src/api.ts](frontend/src/api.ts)의 `fetch()` 호출에 타임아웃이 없어서, 연결이 깔끔하게 끊기지 않고 그냥 멈춰버리는 상황(서버 크래시, 네트워크 불안정 등)에서는 fetch Promise가 영영 안 끝나 "전송 중..."/"..." 상태로 무기한 멈출 수 있음 — `AbortController` 기반 타임아웃 추가가 다음 라운드 후보

### Step 19: 미션 생성 캐싱 (토큰 절감 + "완전 복붙 재생" 방지 절충안)

*배경: 사용자 제안 — 같은 (상대방, 성격) 조합으로 다시 생성하면 항상 새 LLM 호출이 도는데, 매번 LLM으로 새로 만들 필요가 있냐는 질문에서 출발. 논의 결과, 완전 캐싱(재생 반복감 ↑, 재미 요소 훼손 우려)과 무캐싱(비용) 사이 절충안으로 "조합당 N개 풀 + 랜덤 서빙" 채택.*

*핵심 통찰(논의 중 도출): 상대방/성격은 자유입력이라 완전일치 캐싱은 원래 적중률이 낮을 거라 예상했는데, Step 18에서 만든 "🎲 아무거나 골라줘" 랜덤 버튼이 정확히 이 문제를 상쇄함 — 랜덤 버튼 사용자는 고정된 15×11 조합 안에서만 겹치니 자연히 캐시가 잘 먹히고, 직접 타이핑한 사용자는 자유입력이라 어차피 거의 안 겹쳐서 사실상 항상 새로 생성됨. 즉 "신선함을 원하는 사람에게는 항상 신선하고, 아무거나 상관없는 사람에게서만 재활용되는" 구조가 별도 로직 없이 자연히 만들어짐 — 그래서 유사도 매칭 같은 복잡한 걸 안 붙이고 완전일치로만 가기로 결정.*

- **Task 19-1: [DB] `mission_cache` 테이블 추가** `[AGENT 완료]`
  - `(language, difficulty, role_key, personality_key)` 조합으로 조회, `role_raw`/`personality_raw`는 원문 그대로 같이 저장(나중에 정규화 규칙 튜닝할 때 참고용)
  - 관련 파일: [backend/supabase/schema.sql](backend/supabase/schema.sql)
  - `[개선 발견]` DB 비밀번호 없이 `supabase db query --linked -f schema.sql`로 마이그레이션 가능 — Management API를 씀. Step 17에서 쓴 `psql` 직접 연결(비밀번호 필요)보다 나은 방법이라 이후엔 이 방식 사용
- **Task 19-2: [Backend] 캐시 레이어 모듈 분리** `[AGENT 완료]`
  - `getCachedMission`/`saveMissionToCache` 2개 함수로 캐시 로직을 `store.ts`와 분리된 별도 모듈에 격리 — 세션 영속성(store.ts)과 미션 캐싱(missionCache.ts)은 서로 다른 관심사라 섞지 않음
  - 정규화는 `trim + lowercase + 공백 정리`만 함(완전일치 매칭 전제와 일관되게 최소한으로)
  - 풀 크기는 `MISSION_CACHE_POOL_SIZE = 5` 상수로 분리 — 나중에 실트래픽 보고 튜닝할 여지를 남겨둠(유지보수성)
  - 캐시 조회/저장 실패는 전부 fail-open(경고 로그만 남기고 새로 생성하는 쪽으로 넘어감) — 캐싱은 최적화 레이어일 뿐 핵심 기능이 아니라, 캐시 인프라 문제가 사용자 흐름을 막으면 안 된다고 판단
  - 인메모리 모드(Supabase 미설정)에서는 캐시를 아예 스킵 — 재시작하면 사라지는 저장소라 캐싱 이점이 없고 복잡도만 늘어남
  - 관련 파일: [backend/src/missionCache.ts](backend/src/missionCache.ts), [backend/src/routes/persona.ts](backend/src/routes/persona.ts)
  - 검증: 동일 조합으로 7회 연속 호출 → 1~5번째는 5.7~7.2초(실제 LLM 생성, 서로 다른 미션 5개가 풀에 쌓임), 6~7번째는 0.09~0.10초(캐시 히트, LLM 호출 없이 즉시 응답). DB 조회로 풀이 정확히 5개에서 멈추고 더 안 늘어나는 것도 확인. 테스트 데이터는 전부 정리

---

## Phase 7: 아케이드 톤 UI 조미료 `[AGENT 완료]`

*배경: Step 15에서 다시 만든 로고(말풍선+체크마크, 픽셀아트 톤, `#4f7cff`)가 예상보다 잘 나와서, 사용자가 "이 로고 느낌을 앱 전체 UI에도 아주 살짝만" 반영하고 싶다고 제안. 본인 표현으로 "조미료로 쓰는 느낌 — 전부 다 아케이드 게임처럼 바꾸는 게 아니라". Task 20-1~20-6 전부 순서대로 착수해 완료.*

### 설계 원칙 (반드시 지킬 가드레일)

- **손대는 것**: 장식/구조 요소(테두리, 진행 표시, 강조 애니메이션, 아이콘) — 로고가 이미 앱 primary 컬러(`#4f7cff`)와 일치하니 거기서 자연스럽게 확장
- **손대지 않는 것**:
  - 본문 텍스트 폰트 — 한글/일본어/중국어를 픽셀 폰트로 바꾸면 가독성이 크게 떨어짐. 픽셀 폰트는 숫자·영문 UI chrome(턴 카운터, 버튼 라벨 등)처럼 좁은 범위에만 스코프
  - 전체 레이아웃 구조 — Step 13 A-1에서 통과시킨 라이트 모드 규약, 체크리스트 대응 요소(뒤로가기, 확대축소 차단 등)는 그대로 유지
  - 미니앱 용량/속도 — 명세서 9절 비기능 요구사항(WebView 성능). 이미지 에셋 추가 최소화하고 순수 CSS(클립패스, box-shadow 등)로 구현하는 걸 우선 검토할 것 — Step 14에서 TDS(무거운 외부 디자인 시스템) 붙였다가 빼버린 전례가 있어서, 이번에도 무거운 라이브러리 추가 없이 가는 게 원칙과 맞음

### 후보 작업 목록 (순서는 임팩트 대비 작업량 기준 추천)

- **Task 20-1: 디자인 토큰 확장** `[AGENT 완료]`
  - `styles.css`의 `:root`에 `--arcade-accent: #ffb703`(로고 파랑 `#4f7cff`와 대비되는 앰버 보조색), `--pixel-border-width: 3px` 추가 — 기존 `--bg`/`--surface`/`--primary` 패턴과 동일하게 토큰화해서 나중에 값만 바꿔도 전체에 반영되게 함
  - ~~숫자·영문 라벨 전용 픽셀 폰트(Google Fonts "Press Start 2P")~~ → **Step 21 규정 점검에서 제거함**(아래 참고)
  - 관련 파일: [frontend/index.html](frontend/index.html), [frontend/src/styles.css](frontend/src/styles.css)
  - 검증: `npm run dev` 브라우저에서 `getComputedStyle`로 `--arcade-accent`/`--pixel-border-width` 값 정상 반영 확인, 콘솔 에러 없음 + 기존 화면 렌더링 회귀 없음(스크린샷 확인)
- **Task 20-2: 버튼/카드 모서리를 각진 픽셀 스타일로** `[AGENT 완료]`
  - 둥근 `border-radius` 대신 2단 계단식(stepped) 모서리 — `clip-path: polygon(...)`로 순수 CSS 구현(이미지 에셋 불필요, 성능 부담 없음), 계단 한 칸 크기는 Task 20-1의 `--pixel-border-width`(3px) 토큰 재사용
  - 적용: `button.primary`, `button.secondary`, `.bubble`, `.certificate-turn`, `.modal-card`
  - `.modal-card`(바텀시트)는 아래쪽이 화면 끝과 맞닿아 있어서 위쪽 두 모서리만 계단식으로 깎는 별도 polygon 사용(4모서리 다 깎으면 하단 노치 틈으로 오버레이가 비쳐 보이는 문제 있어서 분리)
  - 각 셀렉터에 원래 있던 개별 `border-radius`(10px/14px 등)는 전부 제거해 충돌 없앰
  - 관련 파일: [frontend/src/styles.css](frontend/src/styles.css)
  - 검증: 브라우저에서 `getComputedStyle`로 각 요소의 `clip-path`/`border-radius` 실제 계산값 확인, 임시 DOM 주입으로 카드/모달 렌더링 시각 확인(테스트 후 제거)
- **Task 20-3: 턴 카운터를 텍스트 대신 픽셀 프로그레스 바로** `[AGENT 완료]`
  - `{turnNumber} / {maxTurns} 턴` 텍스트를 `maxTurns`칸짜리 블록 게이지로 교체(진행된 턴만큼 `--arcade-accent` 색으로 채워짐) — 순수 `<span>` + CSS, 이미지 없음
  - 텍스트 정보는 스크린리더용으로 게이지 컨테이너의 `aria-label`에 유지(`role="img"`)
  - 관련 파일: [frontend/src/screens/ChatScreen.tsx](frontend/src/screens/ChatScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)(`.turn-counter` → `.turn-gauge`/`.turn-gauge-block`)
  - 검증: 브라우저에서 3/7 상태로 임시 렌더 → 채워진 3칸 + 빈 4칸 시각 확인
- **Task 20-4: "미션 클리어!" 연출 강화** `[AGENT 완료]`
  - 미션 클리어(`ended === "cleared"`) 시에만 `.mission-clear-title` 클래스 부여 — 스케일 팝인(`mission-clear-pop`) 후 `--arcade-accent` 글로우가 2회 깜빡이는 `@keyframes` 애니메이션(레트로 게임 "클리어" 연출 느낌). 실패 화면에는 미적용
  - 관련 파일: [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)
  - 검증: 브라우저에서 애니메이션 재생 확인 — 팝인 직후 프레임(반투명/축소)과 2초 후 정착 프레임(불투명/원색) 스크린샷 비교로 정상 재생 확인
- **Task 20-5: 힌트 버튼(💡) 아이콘을 블록/픽셀 아이콘으로 교체** `[AGENT 완료]`
  - 이모지 대신 인라인 SVG 픽셀 벌브 아이콘(8개 `<rect>`, `shapeRendering="crispEdges"`, `--arcade-accent` 색) — 이미지 에셋 파일 추가 없이 코드로만 구현
  - 관련 파일: [frontend/src/components/PixelHintIcon.tsx](frontend/src/components/PixelHintIcon.tsx)(신규), [frontend/src/screens/ChatScreen.tsx](frontend/src/screens/ChatScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)(`.hint-button` flex 정렬, `.pixel-hint-icon`)
  - 검증: 브라우저에서 힌트 버튼 렌더링 확인, 콘솔 에러 없음
- **Task 20-6 (선택, 검토만): 입력 화면 상단에 로고 배치** `[AGENT 완료 — 실제로 넣어보고 채택]`
  - 원본 로고(`assets/mission_talk_logo_600.png`)를 `sips`로 96px로 리사이즈(5KB)해서 `frontend/src/assets/logo_96.png`로 추가, 입력 화면 헤더에 40×40으로 배치
  - 판단: 실제로 넣어보니 화면이 복잡해지지 않고 브랜드 일관성만 살아서 채택. 카드/제목과 안 겹치고 여백 안에 자연스럽게 들어감
  - 관련 파일: [frontend/src/assets/logo_96.png](frontend/src/assets/logo_96.png)(신규), [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)(`.input-screen-logo`)
  - 검증: 브라우저 스크린샷으로 실제 배치 확인, 콘솔 에러 없음

### Step 21: 아케이드 UI 조미료 규정 재점검 (apps-in-toss-docs MCP 기준)

*배경: Phase 7 구현 완료 후, 사용자 요청으로 실제 앱인토스 공식 문서 MCP(`apps-in-toss-docs`)의 "비게임 출시 가이드"/"UI/UX 가이드"를 다시 조회해서 Task 20-1~20-6이 규정에 맞는지 재검증.*

- **Task 21-1: [점검] Google Fonts CDN 로드가 죽은 코드였던 것 발견 + 제거** `[AGENT 완료]`
  - Task 20-1에서 턴 카운터·버튼 라벨용으로 "Press Start 2P"(Google Fonts)를 로드해뒀는데, Task 20-3에서 턴 카운터 텍스트 자체를 블록 게이지로 교체하면서 이 폰트를 실제로 쓰는 곳이 없어짐(나머지 텍스트는 전부 이 폰트가 지원 안 하는 한글). 문서("빌드 커스터마이징" 가이드)도 CDN 리소스 로드는 네트워크 의존성 때문에 비권장한다고 명시 — 아무 데도 안 쓰면서 외부 CDN 의존만 남기는 건 리스크만 있고 이득이 없어 제거
  - 관련 파일: [frontend/index.html](frontend/index.html)(Google Fonts `<link>` 제거), [frontend/src/styles.css](frontend/src/styles.css)(`.pixel-label` 미사용 클래스 제거)
  - 검증: `tsc --noEmit` + `vite build` 통과, 브라우저 재확인 — 콘솔 에러 없음, 렌더링 회귀 없음
- **Task 21-2: [점검] 나머지 항목은 규정 위반 없음으로 확인, 판단 보류 2건 기록** `[AGENT 완료 — 코드 변경 없음]`
  - ✅ 픽셀 모서리(`clip-path`, Task 20-2): "그래픽 스타일 일관성"(손그림/만화 화풍 지양) 규정은 일러스트·이미지 리소스에 대한 것이라 버튼/카드 모서리 형태와는 무관 — 저촉 없음
  - ✅ 로고 배치(Task 20-6): 문서상 로고 노출 위치 규정(전체탭/혜택탭/푸시/내비/브릿지)은 별도 통합 지점 얘기고, 화면 내부 배치를 금지하는 조항 없음. 로고 파일 자체는 이미 Step 15에서 "600×600 각진 정사각형" 규정 충족 확인됨
  - ✅ `--arcade-accent`(#ffb703, Task 20-1/20-3/20-4에서 사용): `apps-in-toss.config.ts`에 등록된 실제 브랜드 컬러(`brand.primaryColor` = `#4f7cff`)를 건드리지 않은 순수 내부 UI 강조색이라 브랜드 컬러 규정과 무관
  - ⚠️ `[TBD]` 미션 클리어 글로우 애니메이션(Task 20-4): UI/UX 가이드의 "장식적인 효과·이펙트(파티클, 과한 그라데이션 등) 금지" 조항과 완전히 무관하다고 단정하긴 어려움 — 파티클/그라데이션은 아니고 실제 성공 상태를 알리는 짧은 text-shadow 깜빡임이라 취지상 문제없다고 판단했지만, 심사 시 재검토 여지는 있음
  - ⚠️ `[TBD]` 힌트 아이콘 크기(Task 20-5): 문서의 "아이콘은 24~40px로 사용" 기준은 토스 제공 아이콘 세트에 대한 문구라 직접 제작 아이콘에 강제 적용되는지 불명확. 현재 12×16px로 그 범위보다 작음 — 버튼 내부 보조 아이콘이라 실사용상 문제 없어 보이지만 참고용으로 남겨둠
  - 관련 문서: [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame), [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)

### 남은 것

- Task 20-6에서 넣기로 한 로고가 실기기/실 WebView에서도 자연스러운지는 QR 테스트로 재확인 필요(브라우저 검증만 됨)
- Step 21에서 `[TBD]`로 남긴 2건(클리어 글로우 애니메이션, 힌트 아이콘 크기)은 실제 심사 결과가 나오기 전까진 확정 판단 불가

---

## Phase 8: 수료증 개선 `[AGENT 완료]`

*배경: 사용자가 실제로 미션을 클리어해서 수료증 화면을 받아보고, 개발 문서·앱 전체 구조를 다시 학습한 뒤 개선점이 있으면 얘기해달라고 요청. 코드(`ResultScreen.tsx`, `certificate.ts`, `types.ts`)를 다시 읽어 실제로 비어있는 부분 3가지를 확인함:*
1. *백엔드 `CertificateSchema`가 턴별 `{userText, grade, comment}`만 반환하고, 미션 전체에 대한 총평 필드 자체가 없음 — 화면도 턴 카드 나열로 끝나서 "수료증"치고 완결감이 약함*
2. *`ResultScreen`에 `persona.missionGoal`이 prop으로 들어오는데도 공유 문구에만 쓰이고 화면엔 렌더링이 안 돼서, 사용자가 결과 화면만 보고는 자기가 뭘 완료했는지 확인할 방법이 없음*
3. *`.certificate-turn .grade`가 등급 값과 무관하게 전부 `--primary` 파란색 하나로 렌더링돼서, "완벽해요"와 "헉..."이 스캔했을 때 시각적으로 구분이 안 됨*

*세 항목 다 사용자 승인 받아 반영 착수.*

*색상 팔레트는 착수 전 사용자에게 3가지 안(신호등식 그라데이션 / 2단계만 구분 / 직접 지정)을 제시해 확인받음 — "신호등식 그라데이션으로 진행" + "모든 작업을 앱인토스 MCP 규정에 맞게 진행" 확답 받고 착수.*

### Step 22: 백엔드 — 총평 필드 추가

- **Task 22-1: [LLM] `CertificateSchema`에 `overallComment` 필드 추가** `[AGENT 완료]`
  - 기존 턴별 채점과 같은 LLM 호출에서 함께 생성(별도 호출 비용 없음) — 미션 전체에 대한 2~3문장 총평을 한국어·해요체로, "잘한 점 먼저 + 격려하는 톤으로 개선점" 순서로 쓰도록 시스템 프롬프트에 명시(토스 UX 라이팅 가이드의 "부정적 커뮤니케이션 최소화" 원칙 반영 — 아래 Task 24-1 참고)
  - 관련 파일: [backend/src/llm/certificate.ts](backend/src/llm/certificate.ts), [backend/src/types.ts](backend/src/types.ts), [frontend/src/types.ts](frontend/src/types.ts)
  - 검증: 실제 API 호출(easy 난이도, 카페 주문)로 확인 — `overallComment: "주문 문장을 정말 자연스럽고 완벽하게 말했어요! ... 이제 매장에서 먹을지 포장할지까지 말하면 미션을 완벽하게 마무리할 수 있을 거예요."` 정상 반환, 격려 톤 확인. 테스트 세션은 Supabase에서 삭제
- **Task 22-2: [Backend] 기존에 캐시된(총평 없는) 수료증 호환 처리** `[AGENT 완료]`
  - Task 13-3에서 세션에 영구 저장해둔 기존 수료증 데이터는 이 필드가 없는 채로 DB에 남아있음 — 타입을 `overallComment?: string`(optional)로 두고 프론트에서 값 있을 때만 렌더링, 없어도 에러 없이 기존 화면처럼 보이게(fail-open)
  - 관련 파일: [backend/src/types.ts](backend/src/types.ts), [frontend/src/types.ts](frontend/src/types.ts)

### Step 23: 프론트엔드 — 결과 화면 개선

- **Task 23-1: [Frontend] 결과 화면에 미션 목표 표시** `[AGENT 완료]`
  - `ChatScreen`에서 쓰던 `.mission-goal` 클래스 그대로 재사용(새 스타일 추가 없음)
  - 관련 파일: [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx)
- **Task 23-2: [Frontend] 총평 카드 렌더링** `[AGENT 완료]`
  - `overallComment` 있을 때만 턴별 카드 목록 위에 강조 카드(`.certificate-summary`)로 표시(Task 22-2의 하위호환 조건과 짝) — `.hint-box`와 동일한 primary 톤 배경, Task 20-2 픽셀 모서리 그룹에도 포함시켜 다른 카드들과 형태 통일
  - 관련 파일: [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)
- **Task 23-3: [Frontend] 등급별 색상 구분(신호등식)** `[AGENT 완료]`
  - 완벽해요=`--grade-excellent`(신규 초록), 잘했어요=`--primary`(기존 파랑), 그럭저럭이에요=`--text-dim`(기존 회색), 아쉬워요=`--arcade-accent`(기존 앰버), 헉...=`--danger`(신규 토큰화, 기존 `.error` 빨강과 값 통일)
  - 관련 파일: [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx), [frontend/src/styles.css](frontend/src/styles.css)
  - 검증: 5단계 전부 임시 DOM 주입으로 실제 색상 렌더링 확인(초록→파랑→회색→앰버→빨강 그라데이션 육안 확인), `tsc --noEmit` + `vite build` 통과, 콘솔 에러 없음

### Step 24: 앱인토스 MCP 규정 확인

*사용자가 착수 전에 "모든 작업을 앱인토스 MCP 규정에 맞게 진행"을 명시적으로 요청 — 색상 신호등 표시와 총평 기능이 UX 라이팅 가이드와 충돌하지 않는지 사전 확인.*

- **Task 24-1: [점검] "부정적 커뮤니케이션 최소화" 원칙과의 충돌 여부 확인** `[AGENT 완료 — 문제 없음, 설계에 반영]`
  - `askQuestion`으로 확인: 점수/등급 신호등 색상 표시 자체를 금지하는 조항은 없음. 다만 [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)의 "그래픽" 섹션에 "부정적이거나 호소하는 감정 표현은 피하라"는 원칙이 있어, 낮은 등급의 **텍스트/톤**이 여기 걸리지 않게 두 가지로 반영함
    1. 색상 외에 별도의 경고 아이콘·느낌표 등 시각 요소는 추가하지 않음(텍스트 색상만 다르게, Task 23-3)
    2. `overallComment` 프롬프트에 "잘한 점을 먼저 짚고 낙담시키지 않는 톤으로" 명시(Task 22-1)
  - 관련 문서: [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)

---

## Phase 9: 백엔드 전체 점검 (안정성 감사)

*배경: 사용자가 실사용 중 **"가끔 대답이 안 오는 경우가 있다"**(원인 불명)고 리포트. 증상만 있고 원인이 특정되지 않은 상태라, 추측으로 고치지 않고 백엔드 전 파일(`backend/src/**`, 15개 파일 770줄)을 전수 점검하면서 각 가설을 **실제로 재현하거나 실측해서** 확정하는 방식으로 진행.*

*원칙: Phase 1~8이 "기능을 만드는" 단계였다면 Phase 9는 "만든 기능이 안 죽게 하는" 단계. 기능 추가는 하지 않고, 장애 내성·관측성·유지보수성만 다룸.*

### Step 25: 진단 — "대답이 안 옴"의 원인 규명 (증거 수집)

*전략: 증상이 간헐적이라 로그로 추적이 안 됨(애초에 요청 로그 자체가 없었음). 그래서 코드에서 의심 지점을 먼저 뽑고, 각각을 격리된 재현 스크립트나 실측으로 검증함. 재현 안 된 가설은 "원인"이 아니라 "잠재 리스크"로 따로 분류해서 과잉 진단을 피함.*

- **Task 25-1: `[진단]` Express 4 async 핸들러 rejection → 응답 누락 + 프로세스 크래시 (H-1)** `[AGENT 완료 — 재현 성공]`
  - **가설**: Express 4는 async 핸들러가 반환한 Promise의 rejection을 잡지 않음(Express 5에서야 지원). 그런데 `getSession()` 호출이 **try/catch 밖**에 있는 라우트가 4개 있음 — [chat.ts:20](backend/src/routes/chat.ts), [hint.ts:18](backend/src/routes/hint.ts), [certificate.ts:18](backend/src/routes/certificate.ts), [session.ts:18](backend/src/routes/session.ts). Supabase 조회가 네트워크 문제 등으로 던지면 어떻게 되는가?
  - **재현 결과 (실제 실행으로 확인)**:
    1. 클라이언트에 **응답이 영원히 안 감** — 3초 타임아웃 걸어둔 fetch가 `TimeoutError`로 끝남(서버는 아무것도 안 보냄)
    2. 더 심각: `unhandledRejection`이 발생하고, Node 15+ 기본 정책(`--unhandled-rejections=throw`)에 따라 **백엔드 프로세스 전체가 종료 코드 1로 죽음**. 프로세스에 `unhandledRejection` 핸들러가 없는 것도 확인함
  - **영향**: 한 사용자의 DB 조회 실패 한 번이 → 그 요청 무응답 + **서버 프로세스 사망** + 그 순간 처리 중이던 **다른 모든 사용자의 요청도 동시에 끊김** + Render가 재시작하는 동안 다음 요청은 콜드스타트(Task 25-3). 사용자가 겪은 "가끔 대답이 안 옴"과 증상이 정확히 일치
  - **판정**: **1순위 원인.** 간헐적으로 보이는 이유도 설명됨 — Supabase 호출이 항상 실패하는 게 아니라 가끔 실패하기 때문
  - 검증 환경: 실제 설치된 `express@4.22.2` + `node v25.7.0`으로 격리 재현 스크립트 실행

- **Task 25-2: `[진단]` LLM 호출에 타임아웃이 없음 (H-2)** `[AGENT 완료 — 실측]`
  - Anthropic SDK 클라이언트를 옵션 없이 `new Anthropic()`으로 생성 중([client.ts](backend/src/llm/client.ts)) — 실제 기본값을 런타임에서 직접 읽어보니 **`timeout: 600000ms`(10분), `maxRetries: 2`**
  - 즉 최악의 경우 **10분 × (1회 + 재시도 2회) = 최대 30분** 동안 한 요청이 매달릴 수 있음
  - 서버 소켓도 안 끊어줌 — Node `server.timeout`의 기본값이 **`0`(무제한)**인 것 실측 확인(`requestTimeout` 300초는 "요청을 수신하는" 시간 제한이라 응답 지연에는 적용 안 됨)
  - 프론트엔드 `fetch()`에도 타임아웃이 없음 — Step 18 Task 18-4에서 이미 `[TBD]`로 남겨둔 바로 그 갭. 결과적으로 **백엔드·서버소켓·프론트 3중으로 전부 타임아웃이 없어서**, 한 번 늘어지면 화면이 "..." 상태로 무기한 멈춤
  - **판정**: **2순위 원인.** H-1과 달리 프로세스가 죽지는 않지만, 사용자 체감 증상("대답이 안 옴")은 동일

- **Task 25-3: `[진단]` Render 무료 티어 콜드스타트 (H-3)** `[AGENT 완료 — 실측]`
  - 배포된 `https://mission-talk.onrender.com/health`를 연속 3회 측정: **1회차 22.6초** / 2회차 0.32초 / 3회차 0.12초
  - 무료 티어는 유휴 15분이면 인스턴스를 내리고, 다음 요청에서 콜드부팅함. 연결(`time_connect`)은 26ms로 즉시 되는데 응답까지 22.6초 → 네트워크가 아니라 서버 기동 대기가 맞음
  - **판정**: **3순위 원인(구조적 제약).** 코드로는 못 고침 — 유료 티어 전환이나 외부 주기적 핑이 필요한 인프라 결정 사항이라 사용자 판단 영역으로 남김(Step 28)
  - 참고: H-1로 프로세스가 죽으면 그 직후 요청은 항상 이 콜드스타트를 함께 겪음 — 두 원인이 겹쳐서 체감 장애가 증폭됨

- **Task 25-4: `[진단]` `hint.ts`의 `max_tokens: 500` 마진 (H-4)** `[AGENT 완료 — 재현 실패, 잠재 리스크로 분류]`
  - **가설**: Step 18 Task 18-4에서 `chat.ts`의 `max_tokens: 600`이 Sonnet 5 적응형 thinking과 예산을 나눠 쓰다가 JSON이 잘려 크래시했음. [hint.ts](backend/src/llm/hint.ts)는 그보다도 작은 **500**이라 같은 이유로 터질 수 있음
  - **실측**: 당시 실패했던 조건(스페인어 + hard 난이도 + 대화 기록 포함)으로 실제 API를 3회 호출 → **3회 모두 정상**, 출력 토큰 211 / 258 / 261. 여유는 약 2배
  - **판정**: **현재 발생 중인 버그 아님.** 다만 동일 클래스의 실패가 실제로 일어난 전례가 있고 마진이 2배뿐이라, "원인"이 아니라 **잠재 리스크**로 분류하고 예방적으로만 조치(Task 27-3)
  - `[기록]` 재현 안 된 가설을 원인으로 보고하지 않기 위해 이 항목을 일부러 남겨둠 — 이후 유지보수 시 "왜 이걸 건드렸나"의 근거

- **Task 25-5: `[진단]` 관측성 부재 — 애초에 원인 추적이 불가능했던 이유** `[AGENT 완료]`
  - 요청 로그가 전혀 없음. `console.error(err)`가 catch 블록에만 있어서, **H-1처럼 catch에 안 걸리는 실패는 아무 흔적도 안 남김**
  - 어느 엔드포인트가 몇 초 걸렸는지, 어떤 세션에서 터졌는지 알 방법이 없어서 사용자가 "원인은 모르겠음"이라고 한 것이 당연한 상태였음
  - **판정**: 버그는 아니지만, 이번 같은 일이 또 생겼을 때 다시 처음부터 재현해야 하는 구조 → 조치 대상(Task 27-6)

#### 점검했으나 문제 없었던 항목 (과잉 수정 방지용 기록)

- `missionCache.ts` — 조회/저장 실패가 전부 fail-open(경고 로그 후 새로 생성)으로 이미 올바르게 처리됨. 캐시가 죽어도 사용자 흐름을 안 막음
- `store.ts`의 인메모리 폴백 — 분기 자체는 정상. 단 Supabase 경로의 에러가 위로 전파되는 게 H-1과 맞물리는 것이라 store 자체 수정은 불필요
- `chat.ts`의 프롬프트 캐싱 구조(Step 6) — `cache_control` 경계 설정 정상, 회귀 없음
- `certificate.ts` 라우트의 수료증 캐시 재사용(Task 13-3) — idempotent 동작 정상
- 턴 카운트 경계(`turnNumber >= MAX_USER_TURNS`) — off-by-one 없음
- `express.json()` 기본 본문 크기 제한 100kb + Zod의 `userText` 500자 제한 — 과대 요청 방어 이미 충분

### Step 26: 앱인토스 규정 확인 (백엔드 관점)

*사용자 요청에 따라 착수 전 `apps-in-toss-docs` MCP로 백엔드가 지켜야 할 규정을 확인. Phase 5의 감사는 프론트엔드 중심이었어서, 서버 쪽 규정은 이번이 처음 전수 확인.*

- **Task 26-1: `[점검]` 자체 백엔드에 적용되는 규정과 적용 안 되는 규정 구분** `[AGENT 완료]`
  - `askQuestion`으로 확인한 결과, 서버 관련 문서의 상당수가 **"앱인토스가 호출하는 파트너 서버 API"** 규격이라 우리에게 해당되지 않음을 명확히 함. 미션톡 백엔드는 Anthropic·Supabase만 호출하고 앱인토스 서버 API는 호출하지 않음
  - **해당 없음(근거 확보)**: mTLS 인증서, 방화벽 허용 IP, 분당 3,000 QPM 제한, 공통 응답 봉투(`resultType`/`errorCode`, 비즈니스 오류를 HTTP 200으로 내리는 규격) — 문서 확인 결과 *"앱인토스 서버 API를 호출하지 않고 미니앱에서 직접 호출하는 자체 API라면 응답 형식은 자유롭게 정해도 된다"*
    - `[중요]` 이 확인을 안 했으면 응답 봉투 규격을 맞추느라 **프론트엔드 API 계약 전체를 불필요하게 갈아엎을 뻔했음**. 현행 `{ replyText, missionComplete, ... }` 형태를 그대로 유지하는 게 규정상 맞음
  - **해당됨 → 조치 대상**: CORS 허용 Origin 화이트리스트(Task 27-4)
  - **이미 충족**: API 통신 HTTPS만 사용 (Render가 HTTPS 제공, Task 13-4에서 `VITE_API_BASE_URL`로 절대 URL 적용 완료)
  - 관련 문서: [서버 API 이용하기](https://developers-apps-in-toss.toss.im/documentation/integration/server-api), [응답 형식](https://developers-apps-in-toss.toss.im/documentation/api/response-format), [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame)

- **Task 26-2: `[점검]` 미니앱 Origin 도메인 확정** `[AGENT 완료]`
  - SDK 3.x(우리가 쓰는 버전) 기준 웹뷰 미니앱 Origin은 **2개**
    | 환경 | Origin |
    |---|---|
    | 실제 서비스 | `https://mission-talk.web.tossmini.com` |
    | 콘솔 QR 테스트 | `https://mission-talk.private-web.tossmini.com` |
  - `<appName>`은 콘솔 등록값(Step 15에서 `mission-talk`으로 확정)을 그대로 대입
  - `[중요]` SDK 1~2.x와 3.x의 Origin 도메인이 다름 — 문서/실제 패키지 버전 드리프트(Task 13-2, 13-3, 14-5와 동일 패턴)라 3.x 기준만 채택
  - 관련 문서: [SDK 3.x 마이그레이션](https://developers-apps-in-toss.toss.im/documentation/integration/sdk-3.x)

- **Task 26-3: `[점검]` 응답 지연 / 통신 실패 안내 규정** `[AGENT 완료 — 판단 기록]`
  - *"인터랙션 반응이 2초 이상 지연되지 않아요"* — LLM 호출 특성상 2~6초는 구조적으로 불가피(Step 12에서 이미 `⚠️ 판단 보류`로 기록됨). 이번 조치로 **무한 대기는 없어지고 최악의 경우가 유한한 시간 내 에러로 수렴**하므로 상황은 개선되지만, 2초 기준 자체를 충족시키는 건 아님 — 판단 보류 상태 유지
  - *"서버 통신이 끊기는 경우 알럿 노출 + close 로직 구현 권장"* ([긴급 점검 설정하기](https://developers-apps-in-toss.toss.im/guide/operation/check)) — **프론트엔드 작업 영역**이라 Step 28로 인계

### Step 27: 조치 (백엔드)

*순서는 심각도순: H-1(프로세스 사망) → H-2(무한 대기) → 규정 → 운영 안정성. 각 항목은 독립적으로 되돌릴 수 있게 파일 단위로 분리.*

*구조 결정: 에러 처리·로깅·CORS 같은 "HTTP 경계 관심사"를 라우트/도메인 코드에서 떼어내 `backend/src/http/` 디렉터리로 분리함. 기존 `llm/`(외부 모델 호출), `routes/`(엔드포인트), `store.ts`/`missionCache.ts`(영속성) 구분과 같은 결의 분리라 새 개념을 도입하지 않으면서, 나중에 응답 형식·로그 포맷을 바꿀 때 고칠 파일이 한 곳으로 모임.*

- **Task 27-1: [Backend] async 에러 안전망 — `asyncHandler` + 전역 에러 핸들러 (H-1 해소)** `[AGENT 완료]`
  - **`asyncHandler`**: async 라우트 핸들러의 rejection을 `next(err)`로 넘겨주는 래퍼. Express 4가 Promise를 안 보는 문제를 라우트마다 try/catch를 덧대는 대신 **한 겹의 래퍼로 구조적으로 차단**함(라우트가 try/catch를 잊어도 안전한 구조가 핵심 — 실수 가능성 자체를 없앰)
  - **`AppError` + 헬퍼**(`badRequest`/`notFound`/`conflict`/`upstreamFailure`): 라우트가 `res.status().json()`을 직접 만들지 않고 `throw`로 실패를 표현. 응답 형태 결정은 `errorHandler` 한 곳으로 집중됨 → 헬퍼 함수(`sessionGuards.ts`)처럼 `res`에 접근할 수 없는 깊이에서도 실패를 정확히 전달 가능
  - **`errorHandler`**: 모든 에러 응답의 단일 통로. 예상된 실패(4xx)는 스택 없이, 5xx는 원인(`cause`)까지 로깅. 예상 못 한 예외는 내부 메시지를 감추고 일반 문구로 응답(스키마·자격증명 힌트 유출 방지), 실제 원인은 서버 로그에만
  - **프로세스 레벨 안전망**: `unhandledRejection`은 **로그만 남기고 프로세스를 유지**(이 서버는 요청 간 공유 인메모리 상태가 사실상 없고 모든 세션 상태가 Supabase에 있음 — 서버를 내려서 다른 사용자 요청까지 끊고 22초 콜드스타트를 유발하는 게 더 큰 피해라고 판단). 반면 `uncaughtException`은 이벤트 루프 상태를 신뢰할 수 없어 로그 후 정상 종료
  - 관련 파일: [backend/src/http/asyncHandler.ts](backend/src/http/asyncHandler.ts)(신규), [backend/src/http/AppError.ts](backend/src/http/AppError.ts)(신규), [backend/src/http/errorHandler.ts](backend/src/http/errorHandler.ts)(신규), [backend/src/routes/](backend/src/routes/) 5개 전부, [backend/src/index.ts](backend/src/index.ts)
  - **검증 (Task 25-1과 동일 조건으로 회귀 테스트)**: `SUPABASE_URL`을 존재하지 않는 호스트로 돌려 **실제 DB 장애를 일으킨 상태에서** 요청을 4회 연속 전송
    - 조치 전: 무응답 + 프로세스 사망(exit 1) / **조치 후: 매번 `500 {"error":"서버 내부 오류가 발생했습니다..."}` 응답, 4회 모두 프로세스 생존, 이후 헬스체크도 정상 200**
    - 서버 로그에 요청 ID·스택트레이스·소요시간이 남는 것까지 확인
  - `[불변식]` 앞으로 `router.post("/", async ...)`처럼 async 함수를 **직접** 넘기면 안 됨 — 반드시 `asyncHandler()`로 감쌀 것. (Express 5로 올리면 불필요해지지만 그전까지는 이게 유일한 안전망). grep으로 누락 0건 확인함

- **Task 27-2: [LLM] Anthropic 호출 타임아웃/재시도 정책 명시 (H-2 해소)** `[AGENT 완료]`
  - `new Anthropic()` → `new Anthropic({ timeout: 30_000, maxRetries: 1 })`
  - **timeout 10분 → 30초**: 실측 지연이 2~6초 수준이라 30초는 5배 이상 여유. 정상 요청은 안 잘리면서 늘어진 요청은 확실히 끊음
  - **maxRetries 2 → 1**: 재시도는 일시적 429/5xx 대응에 여전히 유효하지만, 재시도 횟수가 곧 최악 대기시간의 배수임. 사용자가 화면 앞에서 기다리는 대화형 앱이라 "무한 대기보다 빠른 실패"를 택함
  - 수료증 채점만 `CERTIFICATE_TIMEOUT_MS = 60초`로 개별 상향(요청별 옵션으로 전달) — 7턴 전체 채점 + 총평이라 구조적으로 더 무거움. 실측 7.2초로 여유 충분
  - **최악 대기시간: 약 30분 → 약 60초** (수료증은 약 120초). 이 값이 Step 28 F-1의 프론트 타임아웃을 정하는 기준이 됨
  - 관련 파일: [backend/src/llm/client.ts](backend/src/llm/client.ts), [backend/src/llm/certificate.ts](backend/src/llm/certificate.ts)
  - 검증: 런타임에서 적용값 확인(`timeout=30000, maxRetries=1`) + SDK가 timeout 옵션을 실제로 강제하는지 별도 확인(timeout 1ms 클라이언트로 호출 → 31ms 만에 `APIConnectionTimeoutError`)

- **Task 27-3: [LLM] `max_tokens` 상수화 + 마진 확보 (H-4 예방)** `[AGENT 완료]`
  - 4개 파일에 흩어져 있던 매직넘버(2000/2000/500/4000)를 `client.ts`의 `MAX_TOKENS` 객체 한 곳으로 모음. **왜 이 값이 응답 길이 제한이 아닌지**(Sonnet 5 적응형 thinking이 같은 예산을 나눠 씀) 주석으로 못박아, Step 7처럼 "응답이 길다 → max_tokens를 줄이자"는 판단이 반복되지 않게 함
  - `hint`만 500 → 2000으로 상향. 실제 출력은 250 내외라 **과금은 실사용 토큰 기준이므로 비용 영향 없음**, 순수 안전 마진
  - 관련 파일: [backend/src/llm/client.ts](backend/src/llm/client.ts), [persona.ts](backend/src/llm/persona.ts) / [chat.ts](backend/src/llm/chat.ts) / [hint.ts](backend/src/llm/hint.ts) / [certificate.ts](backend/src/llm/certificate.ts)
  - 검증: 실제 힌트 API 호출 정상 응답 확인(스페인어, 3.5초)

- **Task 27-4: [Backend] CORS Origin 화이트리스트 (규정, Task 26-2)** `[AGENT 완료]`
  - `cors()`(전 세계 모든 Origin 허용) → 앱인토스 미니앱 Origin 2개 + (개발 환경에서만) localhost 2개
  - **Origin 헤더가 없는 요청은 통과**시킴 — CORS는 브라우저 보호 장치라 curl·Render 헬스체크·서버 간 호출을 막을 이유가 없고, 막으면 헬스체크와 운영 점검이 깨짐
  - **차단 시 경고 로그를 남김** — 앱인토스가 도메인 규칙을 바꿨을 때 "프로덕션에서만 전부 실패"하는 상황의 원인을 로그만 보고 즉시 알 수 있어야 하기 때문
  - **확장 지점 2개**: `APPS_IN_TOSS_APP_NAME`(appName 변경 시), `ALLOWED_ORIGINS`(쉼표 구분, 비상시 코드 배포 없이 Origin 추가). 규정이 바뀌어도 Render 환경변수만으로 대응 가능
  - 관련 파일: [backend/src/http/cors.ts](backend/src/http/cors.ts)(신규), [backend/src/index.ts](backend/src/index.ts)
  - 검증: 실서비스 Origin·QR 테스트 Origin → `Access-Control-Allow-Origin` 정상 반환 / 무관한 Origin → 헤더 없음(브라우저 차단) / Origin 없는 요청 → 200 통과. `NODE_ENV=production` 빌드에서 localhost가 목록에서 빠지는 것까지 확인
  - ⚠️ **`(USER 액션: 개발 워크플로 영향)`** — 이제 **`vite preview`(localhost:4173)로 배포된 Render 백엔드를 직접 테스트하면 CORS에 막힙니다** (Step 16에서 쓴 검증 방법). 그때는 Render 환경변수에 `ALLOWED_ORIGINS=http://localhost:4173`을 임시로 추가하고 테스트 후 지우세요. 로컬 개발(`npm run dev`)은 Vite 프록시를 타므로 영향 없음

- **Task 27-5: [Backend] graceful shutdown + 404 핸들러** `[AGENT 완료]`
  - **graceful shutdown**: Render는 재배포·스케일다운 시 SIGTERM을 보냄. 처리하지 않으면 프로세스가 즉시 죽으면서 **처리 중이던 요청이 응답 없이 끊김** — 사용자에겐 이것도 똑같이 "대답이 안 옴"으로 보임. 즉 **배포할 때마다 재현되던 무응답 경로**였음. 새 연결을 닫고 진행 중인 요청을 최대 15초 기다린 뒤 종료(강제 종료 타이머는 `unref()`로 정상 종료를 지연시키지 않게 함)
  - **404 핸들러**: 없으면 Express 기본 **HTML** 에러 페이지가 나가서, JSON만 기대하는 프론트엔드의 파싱이 깨지고 엉뚱한 에러 메시지가 표시됨
  - **`trust proxy` 설정**: Render는 리버스 프록시 뒤에 있어서, 이 설정이 없으면 `req.ip`가 프록시 IP로 찍혀 로깅·진단이 어긋남
  - 관련 파일: [backend/src/index.ts](backend/src/index.ts), [backend/src/http/errorHandler.ts](backend/src/http/errorHandler.ts)
  - 검증: 실제 SIGTERM 전송 → `[shutdown] SIGTERM 수신 ... 정상 종료 완료` 로그 후 종료 확인 / 없는 경로 요청 → HTML이 아닌 `404 {"error":"경로를 찾을 수 없습니다: ..."}` JSON 확인

- **Task 27-6: [Backend] 요청 로깅 (관측성, Task 25-5 해소)** `[AGENT 완료]`
  - 요청당 **완료 시점 1줄**만 기록: `[요청ID] METHOD /path → status (소요ms)`. 시작 시점 로그는 안 남김 — Render 무료 티어 로그 보존량이 넉넉하지 않고, 줄 수가 늘면 중요한 신호가 묻힘
  - 상태코드/지연에 따라 레벨 자동 승격(5xx=error, 4xx 또는 10초 초과=warn) — **조용히 늘어지는 요청**이 로그에서 눈에 띄게 함
  - **`finish` 없이 `close`가 오면 별도 에러 로그** — Task 25-1에서 겪은 "응답이 영원히 안 감" 부류가 재발하면 여기서 반드시 잡힘. 이번 라운드에서 없앤 버그를 **다시 놓치지 않기 위한 감시선**
  - 요청 ID는 UUID 앞 8자 — `errorHandler`의 에러 로그와 같은 ID를 쓰므로, 사용자가 "몇 시쯤 안 됐어요"라고만 해도 해당 요청의 상태·소요시간·스택을 한 줄로 엮어서 볼 수 있음
  - 관련 파일: [backend/src/http/requestLogger.ts](backend/src/http/requestLogger.ts)(신규), [backend/src/index.ts](backend/src/index.ts)
  - 검증: E2E 17개 요청 전부 정상 기록, `close` 감시선 **오탐 0건** 확인(정상 응답을 실패로 잘못 잡지 않음)

- **Task 27-7: [Backend] 세션 상태 가드 정리** `[AGENT 완료]`
  - 4개 라우트에 복사되어 있던 세션 조회 + 존재 검증을 `sessionGuards.ts`(`requireSession`/`requireActive`)로 통합. 중복 제거보다 중요한 건 **이 조회가 이제 throw로 실패를 전달**한다는 점 — H-1의 발생 지점이 바로 여기였음
  - **`[동작 변경]`** 수료증 생성이 **종료된 세션에서만** 가능하도록 제한(진행 중이면 409). 수료증은 한 번 만들면 세션에 영구 저장되고 이후 재조회 시 그대로 반환되므로(Task 13-3), 진행 중에 채점하면 **남은 턴이 영영 반영되지 않은 수료증이 고정**됨. 현재 프론트엔드는 종료 후에만 호출하므로 **실제 동작 영향 없음** — 클라이언트 구현과 무관하게 API가 스스로 불변식을 지키게 하는 방어 코드
  - 관련 파일: [backend/src/routes/sessionGuards.ts](backend/src/routes/sessionGuards.ts)(신규), [backend/src/routes/](backend/src/routes/) 4개
  - 검증: 진행 중 세션에 수료증 요청 → `409 {"error":"아직 진행 중인 세션입니다."}` (LLM 호출 없이 0.07초) / 종료 후 요청 → 정상 채점 / 재요청 → 캐시 반환 0.026초

#### 전체 검증 (실제 API + 실제 Supabase, 로컬)

- 스페인어 / medium / "타파스 바 사장님" + "수다스럽고 정 많음" 조합으로 **입력 → 힌트 → 턴1 → 턴2(미션 클리어) → 수료증 → 세션 복원 조회**까지 전 구간 실행
  - 페르소나 11.8초 / 힌트 3.5초 / 턴 4.9초·4.6초 / 수료증 7.2초 / 수료증 재요청 0.026초(캐시) / 세션 복원 0.043초
  - 수료증에 5단계 등급·한국어 comment·`overallComment` 총평 전부 정상 포함 확인(Phase 8 회귀 없음)
- **에러 응답 형태가 조치 전과 완전히 동일**한 것 확인 — 400(Zod flatten 객체) / 404 / 409 / 502 / 500 전부 `{ error: ... }` 유지 → **프론트엔드 수정 불필요**(Step 28 F-4)
- `tsc --noEmit` 통과, `npm run build` 후 `dist/`에서 `NODE_ENV=production`으로 실제 기동까지 확인 (Render와 동일 경로)
- 검증에 쓴 테스트 세션·미션 캐시 행은 Supabase에서 전부 삭제함

### Step 28: 프론트엔드 인계 사항 (백엔드 담당 범위 밖)

*이번 라운드는 백엔드만 담당하기로 한 작업이라 프론트 코드는 건드리지 않음. 다만 아래는 백엔드 변경과 짝이 맞아야 완결되는 항목이라 인계용으로 명시.*

- **F-1 `[필수·짝맞춤]` `fetch()` 타임아웃 추가** — Task 27-2로 백엔드는 이제 유한 시간 내에 반드시 응답하거나 에러를 냄. 하지만 **네트워크 자체가 끊기는 경우**(터널 진입, 와이파이 전환 등)는 여전히 프론트 `fetch`가 무한 대기함. `AbortController` + `AbortSignal.timeout()`으로 클라이언트 타임아웃 필요
  - 대상 파일: [frontend/src/api.ts](frontend/src/api.ts)의 `postJSON`/`getJSON`
  - 권장값: 백엔드 상한(Task 27-2에서 LLM 60초 + 여유)보다 살짝 길게 잡아야 함 — 짧게 잡으면 정상 처리 중인 요청을 클라이언트가 먼저 끊어버려서 오히려 성공률이 떨어짐
  - Step 18 Task 18-4의 `[TBD]`와 동일 항목 (그때 다음 라운드 후보로 남겨둔 것)
- **F-2 `[규정 권장]` 통신 실패 시 안내 + 종료 로직** — Task 26-3 참고. 현재는 에러를 빨간 텍스트로만 표시. Task 14-1에서 만든 자체 `ConfirmModal`을 재사용하면 TDS 없이도 대응 가능
- **F-3 `[선택]` 콜드스타트 체감 개선** — Task 25-3의 22.6초는 첫 요청에서만 발생. 입력 화면 진입 시점에 `/health`를 미리 한 번 호출해두면(워밍업) 사용자가 실제로 미션을 시작할 때는 이미 인스턴스가 떠 있음. 백엔드는 이미 `/health`를 제공하므로 프론트에서 호출만 하면 됨
- **F-4 `[정보]` API 응답 형식 변경 없음** — Task 26-1 결론에 따라 기존 응답 스키마를 그대로 유지함. **프론트엔드 수정 불필요**(에러 응답의 `error` 필드 형태도 동일)

---

## Phase 10: 프론트엔드 통신 안정화 (Phase 9 짝맞춤) `[AGENT 완료]`

*배경: Phase 9에서 백엔드가 "반드시 유한 시간 내에 응답하거나 에러를 낸다"는 보장을 갖췄음(Task 27-1, 27-2). 하지만 그 보장은 **요청이 백엔드까지 도달했을 때만** 성립함 — 네트워크 자체가 끊기는 경로(터널 진입, 와이파이↔LTE 전환, 기기 슬립)는 백엔드를 아무리 고쳐도 프론트 `fetch`가 무한 대기함. Step 28에서 인계받은 F-1~F-3을 처리해서 "무한 대기 없음"을 클라이언트 쪽에서도 완성하는 라운드.*

*범위: 프론트엔드만. 백엔드 코드는 건드리지 않음(담당 분리). API 응답 스키마도 변경 없음(Task 26-1 / F-4 결론에 따라 기존 계약 유지).*

### 착수 전 발견: 인계받은 권장 타임아웃 값의 산술 갭

*Step 28 F-1의 권장값은 `/persona/generate` 45초였으나, Phase 9 문서의 다른 실측치와 교차 검증하니 이 엔드포인트만 값이 부족함:*

| 요소 | 근거 | 값 |
|---|---|---|
| Render 콜드스타트 | Task 25-3 실측 | 22.6초 |
| LLM 호출 1회 상한 | Task 27-2 (`timeout: 30_000`) | 30초 |
| **합계 (콜드 상태의 첫 요청)** | | **52.6초 > 45초** |

*즉 유휴 15분 뒤 첫 미션 시작이 **정상 처리 중인데도** 클라이언트가 먼저 끊어버릴 수 있음. `/persona/generate`는 세션의 첫 요청이라 이 경로를 정면으로 맞는 유일한 엔드포인트라서, 여기만 60초로 상향하고 나머지는 인계값을 그대로 씀. 동시에 F-3(워밍업)을 "선택"이 아니라 **이 타임아웃 예산을 지키는 수단**으로 승격해서 함께 구현함 — 콜드스타트를 사용자 대기 경로 밖(입력 화면에서 타이핑하는 동안)으로 밀어내면 애초에 이 합산이 발생하지 않음.*

### Step 29: `fetch` 타임아웃 (F-1)

- **Task 29-1: [Frontend] 엔드포인트별 타임아웃 도입** `[AGENT 완료]`
  - `postJSON`/`getJSON`을 공통 `request()`로 모으고 타임아웃 인자를 받게 함. 값: 기본(`/chat/turn`·`/chat/hint`·세션 조회) 45초 / `/persona/generate` 60초(위 산술 갭) / `/certificate/generate` 75초(백엔드 상한 60초 + 여유)
  - `AbortSignal.timeout()` 대신 **`AbortController` + `setTimeout` 수동 구현** — `AbortSignal.timeout()`은 iOS 16 미만 WebView에 없어서 호출 즉시 `TypeError`가 나고 그러면 *모든* API 호출이 죽음. Step 16의 "실행 환경 가정을 믿지 말 것" 교훈과 같은 맥락
  - `finally`에서 타이머를 정리해, 정상 응답한 요청이 타이머를 남겨 두지 않게 함
  - 대상 파일: [frontend/src/api.ts](frontend/src/api.ts)
  - **검증 (브라우저에서 실측)**: `/chat/turn`의 `fetch`를 "영원히 응답하지 않는" 상태로 만들고 실제로 메시지를 전송
    - **조치 전 동작**: "..." 상태로 무기한 정지 / **조치 후**: `AbortSignal`이 fetch에 실제로 전달된 것(`signalPassedToFetch: true`) 확인 + **45.8초 시점에 abort 발동**(설정값 45초와 일치) → "..." 사라지고 입력창 재활성화, 재시도 가능 상태로 복귀
- **Task 29-2: [Frontend] 실패 종류 구분 (`NetworkError` / `HttpError`)** `[AGENT 완료]`
  - 기존엔 모든 실패가 밋밋한 `Error` — "연결이 끊긴 것"과 "서버가 409를 응답한 것"이 구분되지 않아 안내 문구를 다르게 줄 수 없고, F-2의 발동 조건도 만들 수 없었음
  - **응답이 왔다는 것 자체가 네트워크가 살아있다는 증거**이므로 4xx/5xx는 네트워크 실패로 세지 않음 — 이 구분이 F-2 오탐 방지의 핵심
  - `HttpError`의 메시지 문자열은 기존과 **완전히 동일**하게 유지 → 각 화면의 `e.message` 표시 코드 무수정(회귀 없음). Step 28 F-4(응답 형식 변경 없음)와도 일관됨
  - 검증: 타임아웃은 `"응답이 오래 걸리고 있어요..."`, 연결 불가는 `"네트워크에 연결할 수 없어요..."`로 서로 다른 문구가 실제로 표시되는 것 확인

- **Task 29-3: `[버그 수정, 작업 중 발견]` 네트워크 실패가 멀쩡한 세션 포인터를 지우던 문제** `[AGENT 완료]`
  - Task 29-2로 실패 종류를 구분할 수 있게 되자 드러난 기존 버그: [App.tsx](frontend/src/App.tsx)의 세션 복원 `.catch`가 **실패 원인을 안 가리고 무조건** `clearActiveSessionId()`를 호출하고 있었음. 원래 의도는 "세션이 이미 사라진 경우(404) 조용히 새로 시작"이었는데, **네트워크가 잠깐 끊긴 것만으로도 진행 중이던 미션 포인터가 삭제**됨 — 연결이 복구돼도 이어서 못 하고 처음부터 다시 해야 함
  - 수정: `4xx`(세션이 없거나 id가 잘못됨 = 확실히 못 쓰는 포인터)일 때만 삭제하고, **`5xx`·네트워크 실패는 유지**. 서버/연결의 일시적 문제일 때 세션은 살아있을 수 있음
  - **검증 (실제로 백엔드를 죽여서)**: 미션 진행 중 백엔드 프로세스를 종료 → 새로고침 → 세션 복원이 500으로 실패했는데도 **`localStorage`의 세션 id가 그대로 살아있는 것** 확인 → 백엔드 재기동 후 새로고침하니 **대화 화면으로 정상 복원**됨(보존된 포인터가 실제로 쓸모 있었음을 확인)

### Step 30: 통신 실패 안내 + 종료 로직 (F-2)

- **Task 30-1: [점검] 앱인토스 규정 재확인** `[AGENT 완료]`
  - [긴급 점검 설정하기](https://developers-apps-in-toss.toss.im/guide/operation/check) 원문 확인: *"자체 서버와의 통신이 끊어지는 경우, 클라이언트에서도 알럿을 노출하고 미니앱을 종료하는 로직을 구현하는 것을 권장해요. 미니앱 종료는 closeView를 참고해 주세요."* → 안내 + **종료 수단 제공**까지가 권장 범위인 것을 확인
  - 문구는 [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)의 UX 라이팅 규칙에 맞춤: 해요체, 부정형("안 돼요") 대신 다음 행동을 알려주는 긍정형, **다이얼로그 왼쪽 버튼은 "닫기"로 통일**("취소"는 작업이 취소된다는 오해를 줘서 쓰지 않는다는 규칙)
  - 다크패턴 방지 정책과도 교차 확인 — "예상하지 못한 인터럽트"가 되지 않도록 발동 조건을 Task 30-2처럼 보수적으로 잡음
- **Task 30-2: [Frontend] 연속 실패 추적 모듈** `[AGENT 완료]`
  - **1회 실패로는 모달을 띄우지 않음** — 일시적 실패는 흔하고, 세션은 서버에 저장돼 있어 사용자가 그냥 다시 보내면 됨. 첫 실패에 전면 모달을 띄우면 오히려 방해(다크패턴 방지 정책의 "예상 못 한 인터럽트"와도 상충). **연속 2회**를 임계값으로 잡고, 성공하면 즉시 리셋
  - 화면별로 흩어 넣지 않고 별도 모듈로 분리 — 실패는 App 복원/채팅/수료증 어디서나 나므로, 한 곳에서 세고 App 레벨에서 한 번만 안내하는 구조
  - 사용자가 안내를 닫으면 카운터를 비움 — 닫자마자 다음 실패에 또 뜨는 "잔소리" 방지
  - 관련 파일: [frontend/src/lib/connectionHealth.ts](frontend/src/lib/connectionHealth.ts)(신규)
- **Task 30-3: [Frontend] App 레벨 안내 모달 + 종료** `[AGENT 완료]`
  - Task 14-1의 자체 `ConfirmModal` 재사용(TDS 미사용 결정 유지). 종료는 `Screen.close()` — Step 16 원칙대로 `try/catch`로 감쌈
  - 나가기 확인 모달과 동시에 뜨지 않도록 렌더 조건에 가드 추가(오버레이 중첩 방지)
  - 관련 파일: [frontend/src/App.tsx](frontend/src/App.tsx)
  - **검증 (브라우저에서 네트워크 단절 시뮬레이션)**:
    - 1회 실패 → 빨간 안내 문구만, **모달 안 뜸**(의도대로 방해 없음)
    - 2회 연속 실패 → `"서버와 연결이 불안정해요"` 모달 노출(닫기 / 종료하기)
    - "닫기" 후 3회차 실패 → **다시 뜨지 않음**(카운터 리셋 확인), 이후 2회 더 실패하니 재노출 — 임계값 로직이 일관되게 동작
    - "종료하기" → 콘솔에 `[@apps-in-toss/devtools] closeView called` — 규정 문서가 안내하는 그 `closeView`가 실제로 호출되는 것 확인, 앱은 크래시 없이 정상 유지
    - 네트워크 복구 후 실제 요청 성공 → 모달·에러 없이 정상 진행(복구 경로 확인)

### Step 31: 콜드스타트 체감 개선 (F-3)

- **Task 31-1: [Frontend] 입력 화면 진입 시 `/health` 워밍업** `[AGENT 완료]`
  - fire-and-forget. **연속 실패 카운터에는 반영하지 않음**(`request()`를 일부러 안 씀) — 워밍업 실패는 사용자가 요청한 적 없는 배경 작업이라, 이걸로 모달을 띄우면 오탐이 됨
  - 입력 화면이 마운트될 때마다 실행되므로 "다시 도전하기"로 돌아왔을 때도 다음 미션을 위해 다시 깨움
  - `vite.config.ts` 프록시에 `/health` 추가 — 없으면 로컬 dev에서만 Vite 서버가 받아 404가 나서 프로덕션과 동작이 달라짐
  - 관련 파일: [frontend/src/api.ts](frontend/src/api.ts), [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx), [frontend/vite.config.ts](frontend/vite.config.ts)
  - 검증: 입력 화면 진입 시 `GET /health → 200`이 실제 백엔드까지 나가는 것 네트워크 탭에서 확인(dev에서 2회 호출되는 건 React StrictMode의 이펙트 이중 실행 — 프로덕션 빌드에는 해당 없고, 멱등한 GET이라 무해)

#### 전체 검증

- **정상 흐름 회귀 없음**: 입력 → 페르소나 생성 → 대화 1턴 → 미션 클리어 → 수료증까지 실제 API로 완주. Phase 7(턴 게이지·픽셀 힌트 아이콘) / Phase 8(총평 카드·미션 목표·등급 색상) 전부 정상 표시 확인
- `tsc --noEmit` 통과, `vite build` 통과(번들 219.76 kB, 직전 대비 +1.5 kB)
- 검증에 쓴 세션 행·미션 캐시 행은 Supabase에서 삭제함

#### 남은 것 / 후속 후보

- `[TBD]` **클라이언트 타임아웃과 서버 처리의 경합** — 클라이언트가 45초에 끊었는데 백엔드는 그 턴을 끝까지 처리해 DB에 저장할 수 있음. 그러면 화면엔 실패로 보이는데 서버 턴 수는 올라가 있어 상태가 어긋남. 지금도 새로고침하면 서버 기준으로 복원되므로 **데이터가 깨지지는 않지만**, 사용자가 같은 말을 다시 보내면 턴을 한 번 더 쓰게 됨. 근본 해결은 타임아웃 후 `GET /chat/session/:id`로 재동기화하는 것 — 이번 범위 밖으로 두고 후속 후보로 기록
- `[TBD]` **미션 생성 실패 시 입력값이 초기화됨** — 실패하면 `InputScreen`이 다시 마운트되면서 상대방/성격 입력이 비워짐(Phase 10 이전부터 있던 동작). 실패 후 재시도가 잦아질수록 체감이 나빠지므로 입력값을 상위로 올리는 리팩토링이 후속 후보
- Task 25-3의 콜드스타트 자체(22.6초)는 여전히 인프라 제약 — F-3은 사용자 대기 경로에서 걷어냈을 뿐이고, 유료 티어 전환/외부 주기 핑은 사용자 판단 영역으로 남아 있음

---

## Phase 11: Phase 10 후속 후보 2건 처리 `[AGENT 완료]`

*배경: Phase 10에서 "지금 당장 급하지 않다"고 `[TBD]`로 남겨둔 2건을 사용자가 마저 처리하라고 요청. 둘 다 프론트엔드 전용 수정이라 백엔드는 건드리지 않음. 착수 전 `apps-in-toss-docs` MCP로 관련 규정 확인 — 폼 입력값 유지·재동기화에 대한 명시적 체크리스트 항목은 없고, 다크패턴 방지 정책의 "예측 가능한 흐름" 원칙과 결이 맞는 정도로 확인됨(강제 규정이 아니라 UX 개선 성격).*

### Step 32: 턴 전송 타임아웃 후 재동기화

- **Task 32-1: [Frontend] `NetworkError` 발생 시 `GET /chat/session/:id`로 재동기화** `[AGENT 완료]`
  - `handleSend`의 catch에서 `NetworkError`(타임아웃·연결 끊김)만 재동기화 시도 — `HttpError`(4xx/5xx)는 서버가 이미 결과를 명확히 응답했으므로 대상에서 제외
  - 서버 턴 수(`state.turnNumber`)가 클라이언트가 알던 턴 수보다 늘어나 있으면 "실제로는 성공한 것" → 기존 `buildInitialMessages`로 메시지 목록을 서버 상태로 통째로 재구성하고 에러 문구 없이 정상 종료. 늘어나지 않았으면 진짜 실패 → 기존 에러 문구 그대로 표시(회귀 없음)
  - 메시지를 부분 패치하지 않고 **항상 전체 재구성**하는 이유: 낙관적으로 먼저 넣어둔 사용자 말풍선과 서버 응답 사이에 불일치·중복이 생길 여지를 원천 차단하기 위함(App.tsx의 세션 복원 로직과 동일한 원칙)
  - 관련 파일: [frontend/src/screens/ChatScreen.tsx](frontend/src/screens/ChatScreen.tsx)
  - 범위 밖으로 남기는 것: `/persona/generate`(타임아웃 시 재동기화할 기존 세션이 없음 — 재시도가 곧 새 세션 생성이라 이 문제 자체가 없음), `/certificate/generate`(이미 Task 13-3/27-7에서 idempotent 캐시로 구현돼 있어 재호출 자체가 안전 — 별도 조치 불필요)
  - **검증 (실제 API + 실제 Supabase로 경합 상황을 실측 재현)**:
    1. `/chat/turn`의 실제 요청은 백그라운드로 그대로 흘려보내고(서버는 정상 처리) 클라이언트만 즉시 실패시키는 방식으로 1차 시도 → 실제 서버 상태를 `psql` 없이 REST API로 직접 조회해 **서버는 이미 턴을 저장했음**(`turnNumber: 1`)을 확인. 클라 실패가 서버 성공을 안 막는다는 이 기능의 전제 자체를 실측으로 검증
    2. 같은 방식이지만 클라이언트 실패 시점을 7초 뒤로 늦춰(45초 타임아웃이 2~6초짜리 정상 응답보다 훨씬 늦게 끊기는 실제 순서와 동일하게) 재현 → **에러 문구 없이** 두 메시지 다 화면에 뜨고 턴 게이지가 정상적으로 채워짐(재동기화 성공)
    3. 대조군: 클라이언트를 요청 즉시(0ms) 실패시켜 서버가 아직 처리 중일 때 재동기화가 뜨면 → 의도대로 **재동기화 실패, 기존 에러 문구 정상 표시**(진짜 실패와 오탐 없이 구분됨)
    - 테스트에 쓴 세션·미션 캐시 행은 Supabase에서 삭제함

### Step 33: 미션 생성 실패 시 입력값 보존

- **Task 33-1: [Frontend] 실패한 입력값을 `App.tsx`에 보관했다가 `InputScreen` 재마운트 시 복원** `[AGENT 완료]`
  - `handleStart` 진입 시 시도값을 항상 기억해두고, 실패해서 입력 화면으로 돌아갈 때 그 값으로 초기 state를 채움. 성공하면 애초에 입력 화면으로 안 돌아오므로 무관
  - **의도적으로 지우는 지점**: `leaveToInput()`(나가기 확인 후 이탈 / "다시 도전하기") 호출 시 이 기억값도 같이 비움 — 안 비우면 완전히 새로운 미션을 시작하려는 사용자에게 몇 세션 전에 실패했던 낡은 값이 뜬금없이 채워짐
  - 관련 파일: [frontend/src/App.tsx](frontend/src/App.tsx), [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx)
  - **검증 (브라우저에서 실제 시나리오 재현)**:
    - `/persona/generate`를 강제 실패시키고 언어=중국어/상대방="택시 기사"/성격="무뚝뚝함"/난이도=상으로 제출 → 실패 후 입력 화면으로 돌아왔는데 **네 값 전부 그대로 남아있음**(로딩 화면을 거쳐 컴포넌트가 실제로 언마운트·재마운트됐는데도 유지)
    - 이후 실제 미션을 하나 정상 완주한 뒤, AIT DevTools의 "Back 이벤트 발생"으로 진행 중 이탈("나가기") 트리거 → 입력 화면이 **기본값(영어/빈 칸/중)으로 깨끗하게 초기화**됨(실패 기억값이 새 시작에 새지 않는 것 확인)

#### 전체 검증

- `tsc --noEmit` 통과, `vite build` 통과(번들 220.13 kB)
- 정상 흐름 재확인: 실제 API로 미션 시작 → 3턴 대화 진행 → 정상 응답·턴 게이지 갱신까지 회귀 없음
- 앱인토스 규정: 착수 전 `apps-in-toss-docs` MCP로 확인 — 폼 값 유지·재동기화에 대한 명시적 체크리스트는 없고, 다크패턴 방지 정책의 "예측 가능한 흐름" 원칙과 결이 맞는 개선(강제 규정 아님)

---

## Phase 12: 사용자 트래픽/이벤트 데이터 수집 장치

*배경: 사용자 요청 — 서비스 트래픽/사용 패턴을 나중에 분석할 수 있도록 DB에 이벤트를 쌓는 장치를 만들고 싶다. 대시보드나 분석 UI는 이번 범위 밖, "데이터가 안전하게 쌓이는 구조"만 목표. `mission_talk_sessions`/`mission_cache` 스키마, `store.ts`/`missionCache.ts`의 fail-open 패턴, 기존 문서화 습관을 그대로 이어서 진행.*

*범위: 백엔드만. 이번 라운드에서 새로 필요해진 프론트 작업(공유 이벤트 전송, 랜덤 채우기 플래그 전송)은 Step 36에 인계 사항으로 정리하고 프론트 코드는 건드리지 않음.*

### Step 34: 테이블 설계

- **Task 34-1: [DB] `analytics_events` 테이블 추가** `[AGENT 완료]`
  - **컬럼 구조**

    | 컬럼 | 타입 | 설명 |
    |---|---|---|
    | `id` | uuid PK | |
    | `event_type` | text | 5종 이벤트 타입(아래 Step 35). enum이 아니라 text인 이유는 `language`/`difficulty`와 동일 — 새 이벤트 타입이 늘어날 때 `ALTER TYPE` 마이그레이션 없이 값만 추가하면 되게 하려는 것(Task 1-2 때부터의 컨벤션) |
    | `session_id` | uuid, FK → `mission_talk_sessions(id)` `ON DELETE SET NULL` | 세션이 (현재는 일어나지 않지만) 나중에 삭제되더라도 그 세션에서 나온 과거 이벤트 자체는 분석 이력으로 남아야 하므로 CASCADE가 아니라 SET NULL로 잡음 |
    | `user_key` | text, nullable | 완전 익명 식별키만. 그 이상의 개인식별정보는 어떤 이벤트에도 넣지 않음(사용자 요청 원칙 1) |
    | `language` / `difficulty` | text, nullable | `mission_talk_sessions`에 이미 있는 값이라 중복이지만, 분석에서 가장 자주 쪼개보는 두 축이라 매번 세션 테이블과 조인하지 않도록 일부러 비정규화. `payload` 안에 묻으면 `payload->>'language'` 캐스팅이 필요해 인덱스 활용도 떨어짐 |
    | `payload` | jsonb | 이벤트 타입별 상세 필드(아래 Step 35 표) |
    | `created_at` | timestamptz | |

  - **왜 테이블 하나로 5개 이벤트 타입을 다 담았는가**: 세션 하나의 흐름(생성 → 힌트 N회 → 종료 → 공유)을 시간순으로 보려면 결국 `session_id`로 묶어야 하는데, 타입별로 테이블을 쪼개면 이 조회가 매번 여러 테이블 UNION/JOIN이 됨. `event_type` + `payload`(jsonb) 조합이면 한 테이블에서 필터링·정렬만으로 충분
  - 인덱스 2개: `(event_type, created_at desc)`(타입별 최신순 조회), `(session_id, created_at)`(세션별 타임라인 조회) — 실제 조회 패턴 2가지에 맞춰 최소한으로만
  - RLS: `mission_talk_sessions`/`mission_cache`와 동일 이유로 비활성(서비스 롤 키 전용 접근, Step 12 C-2 결론 재사용). 클라이언트가 Supabase에 직접 붙는 구조로 바뀌면 이 테이블도 그 즉시 켜야 함
  - 관련 파일: [backend/supabase/schema.sql](backend/supabase/schema.sql)
  - 마이그레이션: `supabase db query --linked -f backend/supabase/schema.sql`(Step 19에서 발견한 비밀번호 불필요 방식) 실행 후, `information_schema.columns`로 실제 반영된 8개 컬럼 전부 확인함

### Step 35: 이벤트 기록 모듈 + 라우트 연결

- **Task 35-1: [Backend] `analytics.ts` 모듈 신설** `[AGENT 완료]`
  - `missionCache.ts`의 `getCachedMission`/`saveMissionToCache`와 완전히 동일한 fail-open 패턴 — Supabase insert를 try/catch로 감싸고, `error` 필드로 오는 실패와 네트워크 자체가 끊겨 throw하는 실패 둘 다 warn 로그만 남기고 삼킴
  - 인메모리 모드(`SUPABASE_URL` 미설정)는 이벤트 기록 자체를 스킵 — `missionCache.ts`와 동일 컨벤션
  - **의도적 설계**: 타입별 헬퍼 함수(`recordMissionGenerationRequested` 등)의 반환 타입을 전부 `void`로 선언 — 내부 `recordEvent`는 위 fail-open 덕에 절대 reject하지 않지만, 그와 별개로 호출부가 실수로 `await`해서 **이벤트 기록 완료까지 응답이 늦어지는 것 자체**를 타입 레벨에서 막기 위함(사용자 요청 원칙 2: 절대 흐름을 막지 않아야 함 — 실패뿐 아니라 지연도 포함해서 해석함)
  - 관련 파일: [backend/src/analytics.ts](backend/src/analytics.ts)

- **Task 35-2: [Backend] 5개 이벤트 타입 정의 + 라우트별 연결** `[AGENT 완료]`

    | 이벤트 | 기록 시점 | payload | 연결 파일 |
    |---|---|---|---|
    | `mission_generation_requested` | 세션 생성 성공 직후 | `role`/`personality`(원문), `randomFill`(bool\|null), `cacheHit`(bool) | [routes/persona.ts](backend/src/routes/persona.ts) |
    | `mission_ended` | 진행중→종료로 바뀌는 그 순간(세션당 1회) | `endedReason`, `turnCount` | [routes/chat.ts](backend/src/routes/chat.ts) |
    | `hint_used` | 힌트 생성 성공 직후 | `turnNumber`(1-based, chat.ts의 turnNumber와 동일 규칙) | [routes/hint.ts](backend/src/routes/hint.ts) |
    | `share_result` | 프론트가 직접 보고(아래 Task 35-3) | `outcome`: `toss`\|`web`\|`clipboard`\|`failed` | [routes/events.ts](backend/src/routes/events.ts) (신규) |
    | `llm_error` | 4개 LLM 호출 지점의 catch에서, `upstreamFailure` throw 직전 | `endpoint`, `errorType`(분류) | persona/chat/hint/certificate 라우트 각 catch 블록 |

  - `mission_ended`는 `GET /chat/session/:id`(재접속 시 상태 재조회)에서는 기록하지 않음 — `chat.ts`에서 `endedReason`이 `null`→값 있음으로 **바뀌는 그 요청**에서만 기록해서 세션당 정확히 1행만 남게 함
  - `mission_generation_requested`의 `role`/`personality` 원문 저장은 `mission_cache.role_raw`/`personality_raw`에서 이미 쓰던 전례(Step 19)를 그대로 따름 — 새로운 개인정보 리스크 추가 아님
  - `llm_error`의 `errorType` 분류는 실제 Anthropic SDK 에러 클래스 계층(`APIConnectionTimeoutError`/`RateLimitError`/`APIConnectionError`/`APIError`)을 보고 분기. 우리 코드가 자체적으로 던지는 "구조화 출력 파싱 실패" 에러(일반 `Error`)는 이 계층에 안 걸려 자연히 `parse_or_unknown`으로 분류됨 — 별도 분기 불필요
  - 관련 파일: [backend/src/routes/persona.ts](backend/src/routes/persona.ts), [chat.ts](backend/src/routes/chat.ts), [hint.ts](backend/src/routes/hint.ts), [certificate.ts](backend/src/routes/certificate.ts)

- **Task 35-3: [Backend] `POST /events/share` 신설 (공유 이벤트 수집 창구)** `[AGENT 완료]`
  - **배경**: 공유는 `frontend/src/lib/share.ts`가 앱인토스 SDK/Web Share API/클립보드를 직접 호출하는 100% 클라이언트 동작이라, 백엔드는 이 결과를 알 방법이 원래 없음. 5개 이벤트 중 이것만 유일하게 "프론트가 관찰한 사실을 보고받는" 구조가 필요해서 새 엔드포인트를 팠음
  - `outcome`은 `frontend/src/lib/share.ts`의 `ShareOutcome` 타입(`"toss" | "web" | "clipboard" | "failed"`)과 값 그대로 1:1 매칭되게 Zod enum을 맞춤 — 나중에 두 타입이 어긋나지 않게 하기 위한 의도적 선택
  - `requireSession`으로 별도 세션 조회를 하지 않음 — `analytics_events.session_id`의 FK 제약이 유효하지 않은 sessionId를 어차피 걸러내고, 그 실패는 fail-open대로 로그만 남기고 클라이언트엔 항상 202. 이벤트 기록용 엔드포인트에 매번 세션 조회 왕복을 추가할 이유가 없다고 판단
  - 확장 지점: `/events` 하위에 다른 클라이언트 전용 이벤트가 더 생기면 `routes/events.ts`에 `/events/foo`로 추가하면 됨(`index.ts`에 새 top-level mount 불필요)
  - 관련 파일: [backend/src/routes/events.ts](backend/src/routes/events.ts)(신규), [backend/src/index.ts](backend/src/index.ts)(`/events` 마운트 추가)

### Step 36: 검증 + 프론트엔드 인계 사항

- **Task 36-1: [검증] 5개 이벤트 전부 실제 API + 실제 Supabase로 확인** `[AGENT 완료]`
  - `tsc --noEmit` 통과
  - 로컬 서버 기동 후 실제 흐름 실행: 페르소나 생성(`randomFill: true`) → 힌트 요청 → 7턴까지 진행해 `max_turns` 종료 → `/events/share` 호출. `analytics_events`를 직접 조회해 4개 이벤트(`mission_generation_requested`/`hint_used`/`mission_ended`/`share_result`)가 정확한 `payload`로 저장된 것 확인
  - `/events/share`에 **존재하지 않는 sessionId**로 호출 → 클라이언트는 여전히 `202 {"ok":true}`를 받았지만, 서버 로그에는 `[analytics] 이벤트 기록 실패 (share_result): ... violates foreign key constraint ...`가 남는 것 확인 — fail-open이 실제로 "클라이언트엔 티 안 남, 서버 로그엔 남음"으로 동작함을 실측으로 검증
  - `/events/share`에 잘못된 `outcome` 값 → `400`과 Zod 에러 정상 반환(FK 문제와 별개로 입력 검증은 그대로 작동)
  - `llm_error` 분류는 실제 요청 흐름 안에서 재현하기 어려워(정상 API 키로는 실패를 못 만듦), 잘못된 API 키로 실제 Anthropic API를 호출해 별도로 검증 — `AuthenticationError`(status 401)가 `err instanceof Anthropic.APIError`로 잡혀 `api_error_401`로 분류되는 것을 실제 SDK 응답으로 확인
  - 테스트에 쓴 세션·이벤트·미션 캐시 행은 전부 Supabase에서 삭제함

- **Task 36-2: `[프론트엔드 인계]` 이번 작업으로 새로 생긴 프론트 할 일 2건** `[AGENT 완료 — 기록만, 코드 변경 없음]`
  - **F-5 `[필수]` 공유 결과를 `POST /events/share`로 보고**: 현재 `ResultScreen.tsx`가 `shareProvider.share(message)`를 호출한 뒤 결과(`ShareOutcome`)를 화면 토스트에만 쓰고 있음. 그 결과값을 그대로 `{ sessionId, outcome }`으로 `POST /events/share`에 fire-and-forget으로 보내면 됨(백엔드가 202를 기다리게 만들 필요 없음 — 실패해도 사용자에겐 영향 없는 이벤트 보고이므로). `api.ts`에 얇은 헬퍼 하나 추가하는 정도의 작업
  - **F-6 `[선택]` "🎲 아무거나 골라줘" 사용 여부를 `/persona/generate` 요청에 포함**: `InputScreen.tsx`가 지금은 무작위 채우기 버튼을 누르든 직접 타이핑하든 `role`/`personality`라는 같은 state에 값을 넣을 뿐이라, "이게 랜덤으로 채워진 값인지"를 구분하는 상태 자체가 없음. `handleRandomFill` 실행 시 `true`로, 이후 사용자가 그 입력란을 직접 수정하면 `false`(또는 초기화)로 바뀌는 별도 플래그가 새로 필요함 — 단순히 기존 값을 실어보내는 게 아니라 작은 상태 추가가 필요한 작업이라는 점을 명확히 남김. `generatePersona` 호출 시 `randomFill` 필드로 실어 보내면 백엔드는 이미 이 필드를 받게(옵션) 되어 있어 즉시 반영됨(하위호환 유지 — 안 보내도 기존처럼 동작, `null`로 기록)
  - 두 항목 다 지금 당장 안 해도 서비스는 정상 동작함(옵션 필드/보고성 엔드포인트라 안 보내도 에러 없음) — 다만 F-5를 안 하면 `share_result` 이벤트가 영원히 안 쌓이고, F-6을 안 하면 `randomFill`이 항상 `null`로만 쌓임

#### 남은 것

- 대시보드/분석 UI는 이번 범위 밖(사용자 요청대로 미착수) — 지금은 SQL로 직접 `analytics_events`를 조회해야 함
- F-5/F-6 프론트 작업 전까지는 `share_result` 이벤트가 안 쌓이고 `randomFill`은 항상 `null`

---

## Phase 13: 이벤트 수집 프론트 인계 사항 처리 (F-5, F-6) `[AGENT 완료]`

*배경: Phase 12 Step 36에서 백엔드가 인계한 F-5(공유 결과 보고)/F-6(랜덤 채우기 플래그 전송) 처리. 둘 다 프론트 전용, 백엔드는 이미 배포 완료라 건드리지 않음. 둘 다 "지금 당장 안 해도 서비스는 정상 동작"하는 보고성 작업이지만, 안 하면 `share_result` 이벤트가 영원히 안 쌓이고 `randomFill`이 항상 `null`로만 쌓임.*

### Step 37: 공유 결과 보고 (F-5)

- **Task 37-1: [Frontend] `POST /events/share` fire-and-forget 헬퍼 추가** `[AGENT 완료]`
  - `api.ts`에 `reportShareOutcome(sessionId, outcome)` 추가 — Task 31-1의 `warmUpBackend()`와 동일한 이유로 공용 `request()`를 안 씀: 응답을 기다려서 할 일이 없고, 실패가 `connectionHealth.ts`의 연속 실패 카운터에 잡히면 안 되는(오탐) 배경 보고성 요청이기 때문
  - `outcome` 타입은 `lib/share.ts`의 `ShareOutcome`을 그대로 import — 백엔드 계약이 이미 이 타입 값과 1:1로 맞춰져 있어(Task 35-3) 별도 매핑 코드 불필요
  - 관련 파일: [frontend/src/api.ts](frontend/src/api.ts)
- **Task 37-2: [Frontend] `ResultScreen.handleShare`에서 결과 즉시 보고** `[AGENT 완료]`
  - `shareProvider.share()`가 outcome을 반환하는 그 지점 직후, **await 없이** `reportShareOutcome` 호출 — 공유 버튼의 토스트 문구·비활성화 로직과 순서상 완전히 분리
  - 관련 파일: [frontend/src/screens/ResultScreen.tsx](frontend/src/screens/ResultScreen.tsx)
- **Task 37-3: `[버그 수정, 작업 중 발견]` 로컬 dev 프록시에 `/events` 누락** `[AGENT 완료]`
  - Task 31-1(`/health` 워밍업)과 정확히 같은 종류의 갭: `vite.config.ts`의 dev 프록시 목록에 `/events`가 없어서, 로컬에서 `POST /events/share`가 백엔드가 아니라 **Vite dev 서버 자체에서 404**로 끝나는 것을 실제 테스트 중 발견. 프로덕션은 `VITE_API_BASE_URL` 절대 URL을 쓰므로 이 문제가 없지만, 로컬 개발 중엔 F-5가 항상 조용히 실패하는 상태였음
  - 관련 파일: [frontend/vite.config.ts](frontend/vite.config.ts)
  - **검증 (실제 API + 실제 Supabase)**:
    - 수정 전: 공유 클릭 → 네트워크 탭에 `POST /events/share → 404`(Vite가 응답, 서버 로그엔 아무 기록도 없음)
    - 수정 후(dev 서버 재시작 필요 — 프록시 설정은 핫리로드 안 됨): `POST /events/share → 202`, 백엔드 로그에도 정상 기록. `analytics_events`를 직접 조회해 `payload: {"outcome": "toss"}`가 실제로 저장된 것 확인
    - **제약 준수 검증**: `/events/share`만 골라 강제로 3연속 실패시킨 뒤 공유 버튼을 3번 연속 클릭 → 매번 `console.warn`만 조용히 남고(`"공유 결과 보고 실패(무시 가능)"`) **공유 버튼 UX는 완전히 정상**(항상 devtools mock의 공유 시트로 이어짐, 토스트 문구도 정상 동작), **"서버와 연결이 불안정해요" 모달은 3번 다 안 뜸**(연속 2회 임계값을 우회했다는 뜻 — `connectionHealth.ts`를 안 쓰는 게 실제로 작동함을 확인)
    - 테스트에 쓴 세션 4개·미션 캐시 4개·이벤트 6개는 전부 Supabase에서 삭제함

### Step 38: 랜덤 채우기 플래그 전송 (F-6)

- **Task 38-1: [Frontend] `InputScreen`에 `randomFill` 상태 추가** `[AGENT 완료]`
  - "🎲 아무거나 골라줘" 클릭 시 `true`, 상대방/성격 입력란을 사용자가 직접 고치면(`onChange`) `false`로 리셋
  - 실패 후 복원되는 값(`initialValue`, Task 33-1)에는 이 플래그를 **반영하지 않고 항상 `false`로 시작** — 복원된 값은 이미 한 번 실패해서 다시 손댈 값이라 "랜덤 채우기 그대로"로 보기 애매하다는 인계 시 권고를 그대로 따름
  - 관련 파일: [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx)
- **Task 38-2: [Frontend] `generatePersona` 호출에 `randomFill` 포함** `[AGENT 완료]`
  - `InputValue`에 `randomFill: boolean` 필드 추가 → `App.tsx`의 `generatePersona({ ...value, userKey })` 호출이 스프레드로 이미 넘기고 있어 호출부 자체는 수정 불필요, `api.ts`의 파라미터 타입에만 `randomFill?: boolean` 추가
  - 관련 파일: [frontend/src/screens/InputScreen.tsx](frontend/src/screens/InputScreen.tsx), [frontend/src/api.ts](frontend/src/api.ts)
  - **검증 (실제 API로 요청 바디 캡처)**: 3가지 시나리오 전부 실측
    1. 랜덤 채우기 → 수정 없이 제출 → `randomFill: true`
    2. 직접 타이핑(상대방="편의점 알바생", 성격="친절함") → 제출 → `randomFill: false`
    3. 랜덤 채우기 후 상대방 입력란 끝에 한 글자 추가 → 제출 → `randomFill: false`(리셋 확인)

#### 전체 검증

- `tsc --noEmit` 통과, `vite build` 통과(번들 220.41 kB)
- 정상 흐름 회귀 없음: 실제 미션 하나를 완주(중고 자전거 가격 협상 미션, "완벽해요"/"그럭저럭이에요" 혼합 등급 + 총평 정상 표시)해 Phase 7/8 UI 전부 회귀 없음도 함께 확인

---

## 확정된 결정 요약 (빠른 참조용)

| 항목 | 결정 | 근거 |
|---|---|---|
| 턴 카운트 | 사용자 발화 기준 최대 7턴, LLM이 조기에 클리어 판정하면 즉시 종료 (고정 7턴 아님) | 명세서 5절 TBD 해소 |
| LLM 모델 | `claude-sonnet-5` (전체 엔드포인트 공통) | 지시사항 준수 충분 + 비용/속도 이점, 명세서 9절 "5분 내 완결" 원칙과 부합 |
| 프롬프트 캐싱 | `/chat/turn`에 system + 증분 메시지 캐싱 적용 | 턴이 늘어날수록 인풋 비용 절감폭 증가 |
| 턴 응답 길이 | 1~3문장 강제 지시 + max_tokens 600 하드 캡 | output 폭주(최대 1,238토큰 관측) 방지 |
| 수료증 등급 | 5단계: 완벽해요/잘했어요/그럭저럭이에요/아쉬워요/헉... | 채점 기준은 난이도 무관 동일 적용 |
| 힌트 기능 | 대사에 암묵적으로 섞지 않고, 명시적 UI 버튼(`💡 힌트`) + 별도 API로 제공 | 전 난이도에서 노출, 난이도별 어휘 수준 자동 조정 |
| 가드레일 | 추가 필터링 레이어 없음, 프롬프트 지시만 유지 | 자유입력의 예측불가성이 재미 요소라는 판단 |
| 앱인토스 SDK | Phase 5로 분리. Step 12 감사 항목 중 A/B군 전부 완료(Step 13, 14, 15). 콘솔 등록 완료(miniAppId 68657, 심사 중). 남은 건 심사 결과 대기, TDS 대체 검토 | 코드만으로 완결 안 되고 외부 SDK 접근 필요 |
| 로고 | 말풍선+체크마크 픽셀아트, `#4f7cff`(앱 primary와 동일), 600×600 | Step 15 — 앱 이름("톡"+"미션 클리어")을 아이콘 하나로 표현 |
| 아케이드 UI 조미료 | 완료(Task 20-1~20-6). 디자인 토큰(`--arcade-accent`/`--pixel-border-width`), 버튼·카드·모달 계단식 모서리, 턴 게이지, 클리어 연출, 픽셀 힌트 아이콘, 입력화면 로고 | Phase 7 — 텍스트 폰트·레이아웃 구조는 안 건드리고 테두리/게이지/연출 위주로만 |
| UI 테마 | 라이트 모드로 전환 완료 (Step 13 Task 13-5) | 비게임 출시 가이드 "미니앱 테마는 라이트 모드로 구현돼 있어요" (Step 12 A-1) |
| 사용자 식별키 | `User.getAnonymousKey()` + 로컬 dev 폴백(`FallbackIdentityProvider`) | 문서의 `getAnonymousKey()`는 v3.0.5에서 deprecated, `User.getAnonymousKey()`가 현행 API |
| 세션 재접속 | 클라이언트는 `sessionId`만 보관, 재진입 시 서버에서 최신 상태 재조회(`GET /chat/session/:id`) | 클라이언트-서버 상태 불일치 방지, 수료증도 캐시되어 재채점 없음 |
| 앱인토스 config 파일 | `granite.config.ts`(문서/2.x) 아님, `apps-in-toss.config.ts`(실제 설치된 3.0.5) | 문서와 실제 패키지 버전 간 스키마 차이 실측 확인 |
| 뒤로가기 | `graniteEvent`의 `backEvent` 가로채서 화면별 분기(최초=종료, 진행중=확인모달, 그외=바로 이탈) | 비게임 출시 가이드 뒤로가기 체크리스트 (Step 14 B-2) |
| **TDS(`@toss/tds-mobile`)** | **설치 보류.** 번들에 도메인 화이트리스트 라이선스 게이트로 보이는 난독화 코드 발견(`console.log` 무력화 + charCode 스캔 + 해시 대조). 확인 모달은 TDS 없이 자체 구현으로 대체 | Step 14 참고 — 실사용 전 앱인토스 공식 채널에 문의 필요 |
| Share SDK | `Share.sendMessage` + 폴백 체인(토스→Web Share API→클립보드) | `share`/`getTossShareLink`(최상위 함수)는 v3.0.5에서 deprecated |
| 저장소 | GitHub [oghdy/Mission_Talk](https://github.com/oghdy/Mission_Talk) | Render 배포는 git 연동 필요 |
| 백엔드 배포 | Render, https://mission-talk.onrender.com | 무료 티어 + git 자동배포 |
| SDK 방어 코드 원칙 | 앱인토스 SDK 호출은 전부 try/catch로 감싸고, dev 모드(devtools mock)만 믿지 말고 프로덕션 빌드로 반드시 재검증 | `graniteEvent.addEventListener`가 프로덕션 빌드에서 앱 전체를 하얗게 죽이는 버그를 실제로 겪음 (Step 16) |
| DB | Supabase 실연결 완료 (project ref `ehugyuhdziiqnzrxibfo`, 서울 리전), `mission_talk_sessions` 테이블 실제 생성·검증됨 | Step 17 — 더 이상 인메모리 폴백 아님 |
| 랜덤 채우기 | 상대방/성격 입력란에 "🎲 아무거나 골라줘" 버튼 추가 | 입력 고민하기 귀찮은 사용자 배려 (Step 18) |
| 상대방 입력 규칙 | placeholder·랜덤 풀 모두 순수 역할만, 성격 형용사 안 섞음 | 상대방/성격 두 입력란 역할 혼동 방지 (Step 18) |
| 수료증 피드백 언어 | comment 설명은 항상 한국어, 고친 문장 예시만 학습 언어로 인용 | 한국 사용자용 앱이라 설명까지 외국어로 나오면 안 됨 (Step 18) |
| `/chat/turn` max_tokens | 600 → 2000으로 복원 | Sonnet 5 적응형 thinking이 같은 예산을 나눠 써서 600은 JSON 파싱 크래시 유발 (Step 18) |
| 미션 생성 캐싱 | (언어, 난이도, 상대방, 성격) 완전일치, 조합당 5개 풀 + 랜덤 서빙, 인메모리 모드는 스킵 | 유사도 매칭 없이도 랜덤 버튼 트래픽에서 자연히 적중 — 자유입력엔 항상 신선한 미션 (Step 19) |
| DB 마이그레이션 방법 | `supabase db query --linked -f schema.sql` (Management API, 비밀번호 불필요) | `psql` 직접 연결보다 간편, Step 19에서 발견 |
| 이벤트 수집 | `analytics_events` 테이블 하나에 5종 이벤트(미션생성/미션종료/힌트사용/공유/LLM에러) 기록, `analytics.ts`가 fail-open으로 감쌈. 대시보드는 미착수(SQL 직접 조회) | Phase 12 — 공유 이벤트는 프론트 F-5 완료 전까지 미수집 |
| **백엔드 async 에러 처리** | **모든 async 라우트는 반드시 `asyncHandler()`로 감쌀 것.** 라우트는 `res.status().json()` 대신 `AppError`를 throw | Express 4는 async rejection을 안 잡음 → 무응답 + **프로세스 사망**이 실제로 발생 (Phase 9 Task 25-1에서 재현) |
| 백엔드 에러 응답 | 형태 변경 없음 — 전부 `{ error: ... }` 유지. 생성 위치만 `errorHandler` 한 곳으로 집중 | 앱인토스는 자체 백엔드 응답 형식을 강제하지 않음(Task 26-1) → 프론트 계약 유지가 맞음 |
| LLM 호출 타임아웃 | `timeout: 30초`(수료증만 60초), `maxRetries: 1` | SDK 기본값 10분×3회 = 최악 30분 대기였음. 무한 대기보다 빠른 실패 (Task 27-2) |
| `max_tokens` 관리 | `client.ts`의 `MAX_TOKENS` 한 곳에서 관리, hint는 500→2000 | Sonnet 5 thinking이 같은 예산을 나눠 써서 "응답 길이 제한"으로 쓰면 안 됨 — 매직넘버 분산이 Step 18 크래시의 배경이었음 |
| 백엔드 CORS | 전면 개방 → 앱인토스 Origin 화이트리스트(`*.web.tossmini.com` / `*.private-web.tossmini.com`), Origin 없는 요청은 통과 | 앱인토스 규정(SDK 3.x 기준). `ALLOWED_ORIGINS` env로 비상 확장 가능 (Task 27-4) |
| 백엔드 관측성 | 요청당 완료 1줄 로그(요청ID·상태·소요시간) + `finish` 없는 `close` 감시 | 로그가 전혀 없어서 "가끔 대답이 안 옴"의 원인 추적이 불가능했음 (Task 25-5) |
| 종료 처리 | SIGTERM graceful shutdown(최대 15초), `unhandledRejection`은 로그 후 생존 / `uncaughtException`은 종료 | 배포마다 in-flight 요청이 끊기던 경로. 이 서버는 공유 인메모리 상태가 없어 rejection 후 생존이 더 안전 (Task 27-1, 27-5) |
| 수료증 생성 조건 | 종료된 세션에서만 가능(진행 중이면 409) | 수료증은 영구 저장되므로 진행 중 채점 시 남은 턴이 반영 안 된 채 고정됨 (Task 27-7) |
| **프론트 fetch 타임아웃** | 기본 45초 / `/persona/generate` 60초 / `/certificate/generate` 75초. `AbortSignal.timeout()` 아닌 **`AbortController` 수동 구현** | 백엔드 상한(30·60초)보다 넉넉해야 정상 요청을 안 끊음. persona만 60초인 건 콜드스타트 22.6초 + LLM 30초 = 52.6초라 45초로는 부족하기 때문. `AbortSignal.timeout()`은 iOS 16 미만에 없어서 쓰면 전 API가 죽음 (Task 29-1) |
| 프론트 에러 타입 | `NetworkError`(연결 실패·타임아웃) / `HttpError`(서버가 응답한 4xx·5xx)로 구분. 메시지 문자열은 기존과 동일 유지 | **응답이 왔다 = 네트워크는 정상**이라 4xx/5xx를 통신 장애로 세면 안 됨. 이 구분이 안내 모달 오탐 방지의 핵심 (Task 29-2) |
| 세션 포인터 삭제 조건 | `4xx`일 때만 `localStorage`에서 삭제. `5xx`·네트워크 실패는 유지 | 원인을 안 가리고 지우면 잠깐 끊긴 사용자가 진행 중이던 미션을 영영 잃음 (Task 29-3에서 실제 버그로 발견·수정) |
| 통신 실패 안내 | **연속 2회** 실패 시 `ConfirmModal`로 안내(닫기 / 종료하기), 닫으면 카운터 리셋 | 앱인토스 권장(알럿 + 종료 로직). 1회마다 띄우면 다크패턴 방지 정책의 "예상 못 한 인터럽트"가 됨 (Step 30) |
| 콜드스타트 완화 | 입력 화면 진입 시 `/health` fire-and-forget 워밍업(실패 카운터에 미반영) | 사용자가 입력하는 동안 서버를 깨워 22.6초를 대기 경로 밖으로 밀어냄 (Task 31-1) |
| 턴 전송 타임아웃 재동기화 | `NetworkError`일 때만 `GET /chat/session/:id`로 재조회, 서버 턴 수가 늘어있으면 에러 없이 화면을 서버 상태로 재구성 | 클라이언트가 먼저 끊어도 서버는 처리를 끝냈을 수 있음(실측으로 확인) — `HttpError`는 서버가 이미 결과를 명확히 응답했으므로 대상 아님 (Task 32-1) |
| 미션 생성 실패 시 입력값 | `App.tsx`가 마지막 시도값을 기억했다가 `InputScreen` 재마운트 시 복원. `leaveToInput()`(나가기/재도전)에서는 의도적으로 비움 | 실패마다 처음부터 다시 타이핑하는 불편 해소. 완전히 새로 시작할 땐 낡은 값이 새면 안 됨 (Task 33-1) |
| 공유 결과 보고 | `reportShareOutcome`은 `request()`를 안 쓰는 fire-and-forget — 실패해도 `console.warn`만, `connectionHealth.ts` 카운터에 미반영 | 사용자가 시작 안 한 배경 보고 요청이라 실패해도 공유 UX·통신 안내 모달에 영향 주면 안 됨 (Task 37-1, 37-2) |
| 랜덤 채우기 플래그 | `InputScreen`에 `randomFill` 상태 추가. 랜덤 버튼=true, role/personality 직접 수정 시 false로 리셋. 실패 복원값엔 미반영(항상 false로 시작) | `/persona/generate`에 실어 보내 랜덤 채우기 트래픽과 직접입력 트래픽 구분(Task 38-1, 38-2) |
| Vite dev 프록시 목록 | `/persona`/`/chat`/`/certificate`/`/health`/`/events` — 새 백엔드 엔드포인트 추가 시 여기도 같이 추가할 것 | 프록시 누락 시 로컬에서만 404(프로덕션은 절대 URL이라 무관) — `/health`(Task 31-1), `/events`(Task 37-3)에서 두 번 반복된 실수 |
