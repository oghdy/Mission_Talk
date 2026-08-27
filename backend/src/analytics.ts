import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase.js";
import type { Difficulty, Language } from "./types.js";

/**
 * 트래픽/사용 패턴 분석용 이벤트 로그 (Phase 10).
 *
 * 설계 원칙 (schema.sql의 analytics_events 테이블 주석과 함께 볼 것):
 * 1) 완전 익명 집계용 — 저장하는 사용자 식별 정보는 user_key(익명 해시)뿐. 그 이상의
 *    개인식별정보는 어떤 이벤트의 payload에도 넣지 않는다.
 *    (role/personality 자유입력 원문은 저장하지만, 이건 mission_cache.role_raw/
 *    personality_raw에서 이미 같은 방식으로 저장 중이던 전례를 그대로 따른 것 — Step 19)
 * 2) fail-open 필수 — missionCache.ts의 getCachedMission/saveMissionToCache와 동일하게,
 *    이벤트 기록은 절대 사용자 요청을 실패시키거나 지연시키지 않는다. recordEvent는
 *    내부에서 모든 실패를 삼키고 **절대 reject하지 않으므로**, 아래 recordX 함수들은
 *    일부러 반환 타입을 `void`로 둬서 호출부가 await하지 않도록(=응답 지연 없도록) 강제한다.
 * 3) 인메모리 모드 스킵 — SUPABASE_URL 미설정 시 세션 자체가 재시작하면 날아가는 상태라
 *    이벤트도 같이 스킵한다(missionCache.ts와 동일 컨벤션).
 * 4) 라우트 침습 최소화 — 각 라우트는 이 파일의 recordX 함수를 한 줄 호출하는 것으로 끝난다.
 */

type EventType =
  | "mission_generation_requested"
  | "mission_ended"
  | "hint_used"
  | "share_result"
  | "llm_error";

/** ResultScreen의 shareProvider(frontend/src/lib/share.ts) ShareOutcome과 1:1로 맞춘 값. */
export type ShareOutcome = "toss" | "web" | "clipboard" | "failed";

/** 어느 엔드포인트의 LLM 호출에서 실패했는지. */
export type LlmEndpoint = "persona_generate" | "chat_turn" | "chat_hint" | "certificate_generate";

interface RecordEventInput {
  eventType: EventType;
  sessionId?: string | null;
  userKey?: string | null;
  language?: Language | null;
  difficulty?: Difficulty | null;
  payload?: Record<string, unknown>;
}

/**
 * 이벤트 기록의 유일한 진입점 — Supabase insert 하나를 감싼다.
 * missionCache.ts와 동일하게 error 필드와 throw 두 경로 모두 fail-open으로 처리한다
 * (supabase-js는 HTTP 레벨 실패는 error로 주지만, 네트워크 자체가 끊기면 throw한다).
 */
async function recordEvent(input: RecordEventInput): Promise<void> {
  if (!supabase) return; // 인메모리 모드는 스킵 (missionCache.ts와 동일 컨벤션)

  try {
    const { error } = await supabase.from("analytics_events").insert({
      event_type: input.eventType,
      session_id: input.sessionId ?? null,
      user_key: input.userKey ?? null,
      language: input.language ?? null,
      difficulty: input.difficulty ?? null,
      payload: input.payload ?? {},
    });

    if (error) {
      console.warn(`[analytics] 이벤트 기록 실패 (${input.eventType}):`, error.message);
    }
  } catch (err) {
    console.warn(`[analytics] 이벤트 기록 중 예외 (${input.eventType}):`, err);
  }
}

// ── 이벤트별 헬퍼 ──────────────────────────────────────────────────────────
// 반환 타입이 전부 void인 건 실수가 아니라 의도다 — 호출부가 실수로 await해서
// 응답이 이벤트 기록 완료까지 지연되는 걸 타입 레벨에서 막는다.

export function recordMissionGenerationRequested(params: {
  sessionId: string;
  userKey: string | null;
  language: Language;
  difficulty: Difficulty;
  role: string;
  personality: string;
  /**
   * "🎲 아무거나 골라줘" 버튼 사용 여부. 프론트가 아직 이 값을 안 보내면 undefined →
   * null로 기록(구분: false=직접입력 확인됨, null=버전이 오래돼 알 수 없음).
   * 프론트 작업 필요 — DEVELOPMENT.md Phase 12 Step 36 F-5 참고.
   */
  randomFill: boolean | null;
  /** missionCache.ts 풀 적중 여부. */
  cacheHit: boolean;
}): void {
  void recordEvent({
    eventType: "mission_generation_requested",
    sessionId: params.sessionId,
    userKey: params.userKey,
    language: params.language,
    difficulty: params.difficulty,
    payload: {
      role: params.role,
      personality: params.personality,
      randomFill: params.randomFill,
      cacheHit: params.cacheHit,
    },
  });
}

export function recordMissionEnded(params: {
  sessionId: string;
  userKey: string | null;
  language: Language;
  difficulty: Difficulty;
  endedReason: "cleared" | "max_turns";
  turnCount: number;
}): void {
  void recordEvent({
    eventType: "mission_ended",
    sessionId: params.sessionId,
    userKey: params.userKey,
    language: params.language,
    difficulty: params.difficulty,
    payload: { endedReason: params.endedReason, turnCount: params.turnCount },
  });
}

export function recordHintUsed(params: {
  sessionId: string;
  userKey: string | null;
  language: Language;
  difficulty: Difficulty;
  /** chat.ts의 turnNumber와 동일한 규칙(1-based, 아직 안 보낸 다음 턴 번호). */
  turnNumber: number;
}): void {
  void recordEvent({
    eventType: "hint_used",
    sessionId: params.sessionId,
    userKey: params.userKey,
    language: params.language,
    difficulty: params.difficulty,
    payload: { turnNumber: params.turnNumber },
  });
}

export function recordShareResult(params: { sessionId: string; outcome: ShareOutcome }): void {
  void recordEvent({
    eventType: "share_result",
    sessionId: params.sessionId,
    payload: { outcome: params.outcome },
  });
}

export function recordLlmError(params: {
  endpoint: LlmEndpoint;
  sessionId?: string | null;
  error: unknown;
}): void {
  void recordEvent({
    eventType: "llm_error",
    sessionId: params.sessionId ?? null,
    payload: { endpoint: params.endpoint, errorType: classifyLlmError(params.error) },
  });
}

/**
 * Anthropic SDK 에러를 재시도/장애 파악에 쓸 수 있는 굵은 카테고리로 분류.
 * 우리 코드가 자체적으로 던지는 "구조화 출력 파싱 실패" 에러(llm/*.ts의 평범한 Error)는
 * APIError 계열이 아니므로 자연히 parse_or_unknown으로 떨어진다 — 별도 분기 불필요.
 */
function classifyLlmError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.APIConnectionError) return "connection_error";
  if (err instanceof Anthropic.APIError) {
    return typeof err.status === "number" ? `api_error_${err.status}` : "api_error";
  }
  return "parse_or_unknown";
}
