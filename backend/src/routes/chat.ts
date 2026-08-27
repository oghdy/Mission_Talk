import { Router } from "express";
import { z } from "zod";
import { recordLlmError, recordMissionEnded } from "../analytics.js";
import { badRequest, upstreamFailure } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { processTurn } from "../llm/chat.js";
import { appendTurn } from "../store.js";
import { MAX_USER_TURNS } from "../types.js";
import { requireActive, requireSession } from "./sessionGuards.js";

const router = Router();

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(500),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.flatten());
    }

    const session = requireActive(await requireSession(parsed.data.sessionId));

    let result: Awaited<ReturnType<typeof processTurn>>;
    try {
      result = await processTurn(session, parsed.data.userText);
    } catch (err) {
      // 외부 API(Anthropic) 실패만 502로 감싼다. 이 아래의 DB 저장 실패는 우리 인프라
      // 문제라 502가 아닌 500이 맞으므로 일부러 try 범위를 LLM 호출로만 좁혀둠.
      recordLlmError({ endpoint: "chat_turn", sessionId: session.id, error: err });
      throw upstreamFailure("턴 처리에 실패했습니다.", err);
    }

    const turnNumber = session.turns.length + 1;
    const maxTurnsReached = turnNumber >= MAX_USER_TURNS;

    const endedReason = result.missionComplete
      ? "cleared"
      : maxTurnsReached
        ? "max_turns"
        : null;

    await appendTurn(
      session,
      { userText: parsed.data.userText, assistantText: result.replyText },
      result.missionComplete,
      endedReason,
    );

    // 진행 중 → 종료로 바뀌는 이 순간에만 기록(세션당 정확히 1회) — 재접속 시 재조회되는
    // GET /chat/session에서는 기록하지 않는다.
    if (endedReason) {
      recordMissionEnded({
        sessionId: session.id,
        userKey: session.userKey,
        language: session.language,
        difficulty: session.difficulty,
        endedReason,
        turnCount: turnNumber,
      });
    }

    res.json({
      replyText: result.replyText,
      missionComplete: result.missionComplete,
      turnNumber,
      maxTurns: MAX_USER_TURNS,
      ended: endedReason,
    });
  }),
);

export default router;
