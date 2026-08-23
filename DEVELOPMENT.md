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
  - `(USER 액션: 콘솔에 실제 미니앱 등록 후 appName을 실제 값으로 교체 필요 — 현재 워크스페이스 2개 다 미니앱 0개 확인함)`

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

### Step 15: 콘솔 미니앱 등록 준비 (실제 제출은 보류)

*배경: `apps-in-toss.config.ts`의 `appName: "mission-talk"`가 아직 플레이스홀더였음(Task 13-2). 실제 콘솔 등록이 있어야 내비게이션 바 브랜드 표시(B-5), 실기기 QR 테스트, 로고 등이 전부 풀림. 콘솔 MCP(`miniapp_create`)로 실제 등록 가능하지만 이건 진짜 심사 요청이 걸리는 액션(승인/반려 결과가 이메일로 옴, 영업일 약 2일)이라 사용자 확인 먼저 받음.*

- **Task 15-1: [Infra] 등록 내용 초안 확정** `[AGENT 완료 — 제출은 USER 액션 대기]`
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

  - **`(USER 액션 필요 — 블로커)`**: 로고 이미지 필수(600×600 PNG, 모서리 둥글림 불가, 투명배경 불가) — 아직 없어서 사용자가 "지금은 제출 보류"로 결정함. 로고 준비되면 `image_upload_url` → `miniApp.iconUri`에 넣어서 `miniapp_create` 호출로 이어서 진행
  - 참고: `miniapp_create`는 로고 없이 나눠서 보내면 중간 상태로 심사가 걸려 반려되므로, 로고 포함해서 **한 번에** 전체 페이로드로 호출해야 함

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
| 앱인토스 SDK | Phase 5로 분리. Step 12 감사 항목 중 A/B군 대부분 완료(Step 13, 14). 남은 건 콘솔 실등록, RLS 재검토(불필요), TDS 대체 검토 | 코드만으로 완결 안 되고 외부 SDK 접근 필요 |
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
