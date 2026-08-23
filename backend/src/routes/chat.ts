import { Router } from "express";
import { z } from "zod";
import { processTurn } from "../llm/chat.js";
import { appendTurn, getSession } from "../store.js";
import { MAX_USER_TURNS } from "../types.js";

const router = Router();

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(500),
});

router.post("/", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  }
  if (session.endedReason) {
    return res.status(409).json({ error: "이미 종료된 세션입니다." });
  }

  try {
    const result = await processTurn(session, parsed.data.userText);
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

    res.json({
      replyText: result.replyText,
      missionComplete: result.missionComplete,
      turnNumber,
      maxTurns: MAX_USER_TURNS,
      ended: endedReason,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "턴 처리에 실패했습니다." });
  }
});

export default router;
