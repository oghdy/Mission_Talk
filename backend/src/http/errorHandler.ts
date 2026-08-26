import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "./AppError.js";
import { getRequestId } from "./requestLogger.js";

/**
 * 등록되지 않은 경로에 대한 404 응답.
 * 없으면 Express 기본 HTML 에러 페이지가 나가서, JSON만 기대하는 프론트엔드의
 * `res.json()` 파싱이 깨진다(에러 메시지가 엉뚱하게 찍힘).
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `경로를 찾을 수 없습니다: ${req.method} ${req.path}` });
};

/**
 * 전역 에러 핸들러 — 모든 에러 응답이 반드시 여기 한 곳을 지나간다.
 *
 * asyncHandler가 next(err)로 넘긴 모든 실패가 여기로 모인다. 라우트가 응답 형태를 각자
 * 만들지 않으므로, 나중에 응답 스키마를 바꿔야 할 때 이 파일만 고치면 된다.
 *
 * Express는 인자가 4개인 미들웨어만 에러 핸들러로 인식한다 — `_next`를 안 쓴다고 지우면
 * 조용히 일반 미들웨어가 되어 동작하지 않으니 주의.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const requestId = getRequestId(res);

  // 이미 응답이 나가기 시작한 뒤의 에러는 헤더를 다시 쓸 수 없다.
  // Express 기본 핸들러에 위임해서 연결만 정리하게 한다.
  if (res.headersSent) {
    console.error(`[${requestId}] 응답 전송 중 에러 발생:`, err);
    return next(err);
  }

  if (err instanceof AppError) {
    // 예상된 실패(404/409 등)는 정상 흐름의 일부라 스택까지 남기지 않는다.
    // 단 502(외부 API 실패)는 원인 파악이 필요하므로 cause를 함께 남긴다.
    if (err.status >= 500) {
      console.error(`[${requestId}] ${err.status} ${err.message}`, err.cause ?? "");
    }
    res.status(err.status).json({ error: err.payload });
    return;
  }

  // 여기 오는 건 우리가 예상하지 못한 실패(DB 장애, 코드 버그 등).
  // 내부 메시지를 그대로 노출하면 스키마·자격증명 힌트가 새어나갈 수 있어 일반 문구로 고정하고,
  // 실제 원인은 서버 로그에만 남긴다.
  console.error(`[${requestId}] 처리되지 않은 예외:`, err);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
};
