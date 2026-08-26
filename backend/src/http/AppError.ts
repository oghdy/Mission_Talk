/**
 * 라우트에서 "예상된 실패"를 표현하는 에러 타입.
 *
 * 기존에는 각 라우트가 `return res.status(404).json({ error: "..." })` 형태로 직접 응답을
 * 만들었는데, 그러다 보니 (1) 응답 형태가 라우트마다 조금씩 어긋날 여지가 있고 (2) 헬퍼 함수
 * 안에서는 res에 접근할 수 없어 실패를 위로 알릴 방법이 없었다. throw로 통일하면 호출 깊이와
 * 무관하게 같은 방식으로 실패를 표현할 수 있고, 최종 응답 형태는 errorHandler 한 곳에서만
 * 결정된다.
 *
 * `payload`는 응답 JSON의 `error` 필드에 그대로 들어간다 — 프론트엔드가 기대하는 기존 계약
 * (`{ error: string }` 또는 Zod flatten 결과 객체)을 그대로 유지하기 위함이다.
 * (Step 26 Task 26-1: 앱인토스는 자체 백엔드 응답 형식을 강제하지 않음 → 기존 형태 유지)
 */
export class AppError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown, options?: { cause?: unknown }) {
    super(typeof payload === "string" ? payload : `HTTP ${status}`, options);
    this.name = "AppError";
    this.status = status;
    this.payload = payload;
  }
}

/** 요청 형식이 잘못됨. Zod의 flatten() 결과를 그대로 실어 보낸다. */
export const badRequest = (payload: unknown) => new AppError(400, payload);

/** 대상 리소스(주로 세션)를 찾을 수 없음. */
export const notFound = (message: string) => new AppError(404, message);

/** 요청 자체는 유효하지만 현재 상태에서는 수행할 수 없음(이미 종료된 세션 등). */
export const conflict = (message: string) => new AppError(409, message);

/**
 * 외부 의존성(Anthropic API 등) 호출 실패.
 * 원인 에러를 `cause`로 물려서 errorHandler가 스택까지 로깅할 수 있게 한다.
 */
export const upstreamFailure = (message: string, cause: unknown) =>
  new AppError(502, message, { cause });
