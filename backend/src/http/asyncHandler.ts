import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * async 라우트 핸들러를 Express 4에서 안전하게 쓰기 위한 래퍼.
 *
 * ── 왜 필요한가 (Phase 9 Task 25-1에서 실제로 재현한 장애) ──
 * Express 4는 핸들러가 반환한 Promise를 아예 보지 않는다(Express 5부터 지원).
 * 그래서 async 핸들러 안에서 await가 reject되면:
 *   1) next()도 res.send()도 호출되지 않아 → 클라이언트에 응답이 영원히 안 감
 *   2) 그 rejection이 unhandledRejection이 되고, Node 15+ 기본 정책상
 *      → 백엔드 프로세스 전체가 종료 코드 1로 죽음
 * 즉 한 사용자의 DB 조회 실패 한 번이 서버를 내리고, 그 순간 처리 중이던 다른 모든
 * 사용자의 요청까지 같이 끊겼다. 사용자가 리포트한 "가끔 대답이 안 옴"의 1순위 원인.
 *
 * 이 래퍼는 rejection을 next(err)로 넘겨서 errorHandler가 정상적인 HTTP 에러 응답으로
 * 변환하게 한다. 라우트는 이제 마음 놓고 throw할 수 있다.
 *
 * ── 유지보수 규칙 ──
 * `router.post("/", ...)`에 async 함수를 직접 넘기지 말고 **반드시 이 래퍼를 거칠 것.**
 * (Express 5로 올리면 이 래퍼는 필요 없어지지만, 그때까지는 이게 유일한 안전망이다.)
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
