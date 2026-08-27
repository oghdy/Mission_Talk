import { reportNetworkFailure, reportNetworkSuccess } from "./lib/connectionHealth";
import type { ShareOutcome } from "./lib/share";
import type { Certificate, Difficulty, Hint, Language, Persona, SessionState, TurnResult } from "./types";

// 비워두면(로컬 dev) vite.config.ts 프록시를 통해 상대경로로 호출.
// 빌드된 미니앱은 백엔드와 다른 오리진(https://<appName>.web.tossmini.com)이라
// 절대 URL이 없으면 프로덕션에서 전부 404가 남 — 반드시 배포 전 값 채울 것.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// 백엔드는 Phase 9 Task 27-2에서 LLM 호출에 상한을 걸었다(기본 30초, 수료증 60초).
// 여기 값은 그 상한보다 넉넉해야 한다 — 짧게 잡으면 정상 처리 중인 요청을 클라이언트가
// 먼저 끊어버려서 오히려 성공률이 떨어진다.
const TIMEOUT_MS = {
  default: 45_000,
  // 세션의 첫 요청이라 Render 무료 티어 콜드스타트(실측 22.6초, Task 25-3)를 정면으로
  // 맞는 유일한 엔드포인트. 콜드스타트 22.6초 + LLM 상한 30초 = 52.6초라 45초로는 부족함.
  // warmUpBackend()로 콜드스타트를 대기 경로 밖으로 밀어내는 것과 짝을 이루는 값.
  persona: 60_000,
  // 7턴 전체 채점 + 총평이라 백엔드 상한 자체가 60초로 더 길다(CERTIFICATE_TIMEOUT_MS).
  certificate: 75_000,
} as const;

/** 서버가 응답은 했지만 실패 상태인 경우(4xx/5xx). 네트워크는 정상이라는 뜻이기도 하다. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 응답 자체를 못 받은 경우 — 연결 불가이거나 제한 시간을 넘긴 경우. */
export class NetworkError extends Error {
  constructor(
    readonly kind: "timeout" | "offline",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "NetworkError";
  }
}

function resolveUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // 메시지 형식은 기존과 동일하게 유지 — 각 화면이 e.message를 그대로 표시하고 있음.
    throw new HttpError(res.status, err.error ? JSON.stringify(err.error) : `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  // AbortSignal.timeout()이 더 간결하지만 iOS 16 미만 WebView에 없어서, 그런 환경에선
  // 호출 즉시 TypeError가 나며 *모든* API 호출이 죽는다. AbortController는 훨씬 오래된
  // 환경에도 있으므로 수동 타이머로 구현한다(Step 16 "실행 환경을 가정하지 말 것" 교훈).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(resolveUrl(path), { ...init, signal: controller.signal });
    // 응답이 왔다는 건 네트워크가 살아있다는 뜻 — 4xx/5xx여도 연결 자체는 정상이다.
    reportNetworkSuccess();
    return await handleResponse<T>(res);
  } catch (cause) {
    if (cause instanceof HttpError) throw cause; // 서버가 응답한 실패는 그대로 전달
    reportNetworkFailure();
    throw timedOut
      ? new NetworkError(
          "timeout",
          "응답이 오래 걸리고 있어요. 네트워크 상태를 확인하고 다시 시도해주세요.",
          { cause },
        )
      : new NetworkError(
          "offline",
          "네트워크에 연결할 수 없어요. 연결 상태를 확인하고 다시 시도해주세요.",
          { cause },
        );
  } finally {
    clearTimeout(timer);
  }
}

function postJSON<T>(path: string, body: unknown, timeoutMs: number = TIMEOUT_MS.default): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

function getJSON<T>(path: string, timeoutMs: number = TIMEOUT_MS.default): Promise<T> {
  return request<T>(path, {}, timeoutMs);
}

/**
 * 백엔드를 미리 깨워두는 fire-and-forget 호출. Render 무료 티어는 유휴 15분이면
 * 인스턴스를 내리고 다음 요청에서 22.6초 콜드부팅을 하는데(Task 25-3), 사용자가 입력
 * 화면에서 타이핑하는 동안 미리 깨워두면 "미션 시작하기"를 누를 때는 이미 떠 있다.
 *
 * 일부러 request()를 쓰지 않는다 — 사용자가 요청한 적 없는 배경 작업이라, 이 실패가
 * 연속 실패 카운터에 잡히면 통신 안내 모달이 오탐으로 뜬다.
 */
export function warmUpBackend(): void {
  fetch(resolveUrl("/health")).catch(() => {
    // 워밍업 실패는 사용자 흐름과 무관 — 실제 요청에서 어차피 다시 시도된다.
  });
}

/**
 * 공유가 실제로 어떤 방식으로 끝났는지(Phase 12 Task 35-3) 배경으로 보고한다.
 * warmUpBackend()와 동일한 이유로 일부러 request()를 안 쓴다 — 응답을 기다려서 할
 * 일이 없고(항상 202를 fail-open으로 반환), 이 실패가 connectionHealth.ts의 연속
 * 실패 카운터에 잡히면 사용자가 시작하지도 않은 배경 요청 때문에 통신 안내 모달이
 * 오탐으로 뜬다. 공유 버튼의 UX(토스트 문구 등)와도 완전히 무관하게 흘러가야 한다.
 */
export function reportShareOutcome(sessionId: string, outcome: ShareOutcome): void {
  fetch(resolveUrl("/events/share"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, outcome }),
  }).catch((err) => {
    console.warn("공유 결과 보고 실패(무시 가능)", err);
  });
}

export function generatePersona(input: {
  language: Language;
  role: string;
  personality: string;
  difficulty: Difficulty;
  userKey: string | null;
  // 이 미션이 "🎲 아무거나 골라줘"로 채워진 값 그대로 제출됐는지(true) 여부. 안 보내도
  // 백엔드가 하위호환으로 null 처리하지만, 우리 쪽은 항상 판단 가능하므로 항상 보낸다.
  randomFill?: boolean;
}): Promise<{ sessionId: string; persona: Persona }> {
  return postJSON("/persona/generate", input, TIMEOUT_MS.persona);
}

export function getSessionState(sessionId: string): Promise<SessionState> {
  return getJSON(`/chat/session/${sessionId}`);
}

export function sendTurn(sessionId: string, userText: string): Promise<TurnResult> {
  return postJSON("/chat/turn", { sessionId, userText });
}

export function generateCertificate(sessionId: string): Promise<Certificate> {
  return postJSON("/certificate/generate", { sessionId }, TIMEOUT_MS.certificate);
}

export function getHint(sessionId: string): Promise<Hint> {
  return postJSON("/chat/hint", { sessionId });
}
