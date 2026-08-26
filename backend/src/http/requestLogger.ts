import { randomUUID } from "node:crypto";
import type { RequestHandler, Response } from "express";

/**
 * 요청 단위 로깅 + 요청 ID 부여.
 *
 * ── 왜 필요한가 (Phase 9 Task 25-5) ──
 * 기존에는 catch 블록의 console.error가 로깅의 전부였다. 그래서 catch에 걸리지 않는 실패
 * (Task 25-1의 프로세스 사망, Task 25-2의 무한 대기)는 **아무 흔적도 남기지 않았고**,
 * 사용자가 "가끔 대답이 안 오는데 원인은 모르겠다"고 할 수밖에 없는 상태였다.
 * 같은 일이 또 생겼을 때 처음부터 재현하지 않아도 되도록 최소한의 관측성을 넣는다.
 *
 * 로그는 요청당 완료 시점 1줄만 남긴다(요청 시작 시점에는 안 남김) — Render 무료 티어의
 * 로그 보존량이 넉넉하지 않고, 줄 수가 늘면 오히려 중요한 신호가 묻히기 때문.
 */

/** 응답이 이 시간을 넘기면 경고로 승격 — 조용히 늘어지는 요청을 눈에 띄게 만든다. */
const SLOW_REQUEST_MS = 10_000;

export function getRequestId(res: Response): string {
  return typeof res.locals.requestId === "string" ? res.locals.requestId : "-";
}

export const requestLogger: RequestHandler = (req, res, next) => {
  // 전체 UUID는 로그를 읽기 어렵게만 해서 앞 8자만 씀 — 한 서버 인스턴스의 동시 요청을
  // 구분하는 용도라 이 정도 엔트로피면 충분하다.
  const requestId = randomUUID().slice(0, 8);
  res.locals.requestId = requestId;

  const startedAt = Date.now();
  const label = `${req.method} ${req.originalUrl}`;

  let settled = false;

  res.on("finish", () => {
    settled = true;
    const ms = Date.now() - startedAt;
    const line = `[${requestId}] ${label} → ${res.statusCode} (${ms}ms)`;
    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400 || ms >= SLOW_REQUEST_MS) console.warn(line);
    else console.log(line);
  });

  // finish 없이 close가 오면 = 응답을 끝맺지 못하고 연결이 끊긴 것.
  // Task 25-1에서 겪은 "응답이 영원히 안 감" 부류가 재발하면 여기서 반드시 잡힌다.
  res.on("close", () => {
    if (settled) return;
    console.error(
      `[${requestId}] ${label} → 응답 없이 연결 종료 (${Date.now() - startedAt}ms). ` +
        `클라이언트가 먼저 끊었거나, 핸들러가 응답을 보내지 않았습니다.`,
    );
  });

  next();
};
