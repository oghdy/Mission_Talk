import Anthropic from "@anthropic-ai/sdk";

/**
 * ── 타임아웃/재시도 정책 (Phase 9 Task 27-2) ──
 * 옵션 없이 `new Anthropic()`으로 만들면 SDK 기본값이 **timeout 10분 / maxRetries 2**다
 * (실측으로 확인). 최악의 경우 10분 × 3회 = **최대 30분** 동안 한 요청이 매달릴 수 있고,
 * Node 서버 소켓도 기본이 무제한(`server.timeout = 0`)이라 아무도 끊어주지 않는다.
 * 프론트엔드 fetch에도 타임아웃이 없어서 화면이 "..." 상태로 무기한 멈췄다
 * — 사용자가 리포트한 "가끔 대답이 안 옴"의 2순위 원인.
 *
 * 실측 지연은 페르소나 생성 3~6초, 턴 응답 2~4초 수준이다. 30초는 그 대비 5배 이상의
 * 여유라 정상 요청이 잘릴 일은 없으면서, 늘어진 요청은 확실히 끊는 값으로 잡았다.
 *
 * maxRetries는 2 → 1로 줄였다. 재시도는 일시적인 429/5xx를 넘기는 데 여전히 유효하지만,
 * 재시도 횟수가 곧 최악 대기시간의 배수가 되기 때문에 사용자가 화면 앞에서 기다리는
 * 대화형 앱에서는 1회면 충분하다고 판단했다(무한 대기보다 빠른 실패가 낫다).
 */
export const LLM_TIMEOUT_MS = 30_000;

/**
 * 수료증 채점만 별도 상한. 7턴 전체를 한 번에 채점하고 총평까지 생성해서
 * (max_tokens 4000) 다른 호출보다 구조적으로 오래 걸린다.
 */
export const CERTIFICATE_TIMEOUT_MS = 60_000;

const LLM_MAX_RETRIES = 1;

// 자격 증명은 ANTHROPIC_API_KEY 환경변수 또는 `ant auth login` 프로필에서 자동 해석됨.
export const anthropic = new Anthropic({
  timeout: LLM_TIMEOUT_MS,
  maxRetries: LLM_MAX_RETRIES,
});

// 롤플레잉 대사 생성 + 구조화된 판정 수준의 작업에는 Sonnet 5로 충분하고, 속도/비용 면에서
// "5분 내 완결" 원칙에도 더 잘 맞음. 수료증 채점(특히 일본어/중국어 뉘앙스 평가)의 정확도가
// 실측 결과 아쉬우면 그 부분만 claude-opus-5로 올리는 것을 고려할 것.
export const MODEL = "claude-sonnet-5";

/**
 * ── max_tokens 정책 (Phase 9 Task 27-3) ──
 * Sonnet 5는 적응형 thinking이 기본으로 켜져 있고, **thinking 토큰도 max_tokens 예산을
 * 같이 쓴다.** 그래서 이 값을 "응답 길이 제한"으로 쓰면 안 된다 — 좁게 잡으면 사고 과정이
 * 길어지는 입력에서 JSON이 중간에 잘려 파싱이 깨진다(Step 18 Task 18-4에서 chat.ts가
 * 600으로 실제 크래시했던 사례. 특히 스페인어에서 재현).
 *
 * 응답 길이 통제는 system 프롬프트의 "1~3문장" 지시가 담당하고, max_tokens는 순수하게
 * thinking 여유분을 포함한 안전 상한으로만 쓴다.
 *
 * hint는 실측 출력이 211~261 토큰이라 기존 500으로도 당장은 통과했지만(Task 25-4),
 * 여유가 2배뿐이라 chat.ts와 같은 실패가 언제든 재현될 수 있는 자리였다. 값을 개별
 * 파일에 흩어두면 이런 위험을 다시 놓치게 되므로 여기서 한곳에 모아 관리한다.
 */
export const MAX_TOKENS = {
  /** 페르소나 + 미션 생성 (세션당 1회) */
  persona: 2000,
  /** 대화 턴 처리 (턴당 1회, 가장 호출이 잦음) */
  chat: 2000,
  /** 힌트 생성 — 500 → 2000. 실제 출력은 250 내외라 비용 영향 없음(과금은 실사용 토큰 기준) */
  hint: 2000,
  /** 수료증 채점 — 7턴 전체 평가 + 총평이라 가장 큼 */
  certificate: 4000,
} as const;
