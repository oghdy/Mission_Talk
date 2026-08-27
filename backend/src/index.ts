import "dotenv/config";
import express from "express";
import cors from "cors";
import { allowedOrigins, corsOptions } from "./http/cors.js";
import { errorHandler, notFoundHandler } from "./http/errorHandler.js";
import { requestLogger } from "./http/requestLogger.js";
import personaRouter from "./routes/persona.js";
import chatRouter from "./routes/chat.js";
import hintRouter from "./routes/hint.js";
import sessionRouter from "./routes/session.js";
import certificateRouter from "./routes/certificate.js";
import eventsRouter from "./routes/events.js";

const app = express();

// Render는 리버스 프록시 뒤에서 앱을 돌린다. 이 설정이 없으면 req.ip가 프록시 IP로,
// req.protocol이 항상 "http"로 보여서 로깅·진단이 어긋난다.
app.set("trust proxy", 1);

app.use(requestLogger);
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));

app.use("/persona/generate", personaRouter);
app.use("/chat/turn", chatRouter);
app.use("/chat/hint", hintRouter);
app.use("/chat/session", sessionRouter);
app.use("/certificate/generate", certificateRouter);
app.use("/events", eventsRouter);

// Render 헬스체크 + 프론트엔드의 콜드스타트 워밍업(Step 28 F-3) 대상.
// 의존성(Supabase/Anthropic)까지 확인하지 않고 프로세스 생존만 보고한다 —
// 헬스체크가 외부 API를 호출하면 그쪽 장애가 곧 우리 서비스 재시작으로 번지기 때문.
app.get("/health", (_req, res) => res.json({ ok: true }));

// 라우트에 안 걸린 요청은 Express 기본 HTML 에러 페이지 대신 JSON 404로 응답.
app.use(notFoundHandler);

// 에러 핸들러는 반드시 모든 라우트/미들웨어 등록 이후 마지막에 와야 한다.
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, () => {
  console.log(`mission-talk backend listening on :${port}`);
  console.log(`[cors] 허용 Origin: ${allowedOrigins.join(", ")}`);
});

/**
 * ── Graceful shutdown (Phase 9 Task 27-5) ──
 * Render는 재배포·스케일다운 시 SIGTERM을 보낸다. 이걸 처리하지 않으면 프로세스가
 * 즉시 죽으면서 **처리 중이던 요청이 응답 없이 끊긴다** — 사용자 입장에서는 이것도
 * 똑같이 "대답이 안 옴"으로 보인다. 배포할 때마다 재현되는 셈이라 반드시 필요.
 */
const SHUTDOWN_GRACE_MS = 15_000;

function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} 수신 — 새 연결을 닫고 진행 중인 요청을 기다립니다.`);

  // 진행 중인 요청이 끝나지 않아도 언젠가는 반드시 종료해야 한다.
  // unref()로 이 타이머가 프로세스를 살려두지 않게 한다(정상 종료를 지연시키지 않음).
  const forceExit = setTimeout(() => {
    console.error(`[shutdown] ${SHUTDOWN_GRACE_MS}ms 내에 정리되지 않아 강제 종료합니다.`);
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close((err) => {
    if (err) {
      console.error("[shutdown] 서버 종료 중 오류:", err);
      process.exit(1);
    }
    console.log("[shutdown] 정상 종료 완료.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/**
 * ── 프로세스 레벨 최후 안전망 (Phase 9 Task 27-1) ──
 * Task 25-1에서 겪은 장애의 본질은 "rejection이 아무 로그도 남기지 않고 프로세스를
 * 죽였다"는 것이었다. asyncHandler로 원인을 제거했지만, 앞으로 다른 경로에서 같은 일이
 * 생기더라도 최소한 **흔적은 남도록** 핸들러를 등록해둔다.
 */
process.on("unhandledRejection", (reason) => {
  // 여기서 프로세스를 죽이지 않는 이유: 이 서버는 요청 간 공유하는 인메모리 상태가
  // 사실상 없고(모든 세션 상태는 Supabase에 있음), 남은 rejection은 대개 핵심 흐름
  // 밖에서 발생한다. 그런 이유로 서버 전체를 내려서 다른 사용자 요청까지 끊고
  // 콜드스타트(22초)를 유발하는 것이 오히려 더 큰 피해라고 판단했다.
  console.error("[fatal] 처리되지 않은 Promise rejection (프로세스는 계속 실행):", reason);
});

process.on("uncaughtException", (err) => {
  // 반면 uncaughtException은 이벤트 루프가 불확실한 상태로 남을 수 있어 계속 실행하는 게
  // 위험하다. 로그를 남기고 정상 종료 절차를 밟는다(Render가 재시작해줌).
  console.error("[fatal] 처리되지 않은 예외 — 종료합니다:", err);
  shutdown("uncaughtException");
});
