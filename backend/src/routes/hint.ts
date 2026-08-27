import { Router } from "express";
import { z } from "zod";
import { recordHintUsed, recordLlmError } from "../analytics.js";
import { badRequest, upstreamFailure } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { generateHint } from "../llm/hint.js";
import { requireActive, requireSession } from "./sessionGuards.js";

const router = Router();

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.flatten());
    }

    const session = requireActive(await requireSession(parsed.data.sessionId));

    // try 범위는 외부 API 호출로만 좁힌다 — res.json()까지 감싸면 응답 직렬화 오류가
    // "힌트 생성 실패(502)"로 잘못 보고돼서 원인 추적이 어긋난다.
    let hint: Awaited<ReturnType<typeof generateHint>>;
    try {
      hint = await generateHint(session);
    } catch (err) {
      recordLlmError({ endpoint: "chat_hint", sessionId: session.id, error: err });
      throw upstreamFailure("힌트 생성에 실패했습니다.", err);
    }

    // 실제로 힌트를 받은 경우만 "사용"으로 기록 — turnNumber는 chat.ts와 동일한 규칙
    // (1-based, 사용자가 아직 안 보낸 다음 턴 번호).
    recordHintUsed({
      sessionId: session.id,
      userKey: session.userKey,
      language: session.language,
      difficulty: session.difficulty,
      turnNumber: session.turns.length + 1,
    });

    res.json(hint);
  }),
);

export default router;
