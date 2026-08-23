import { Router } from "express";
import { z } from "zod";
import { getSession } from "../store.js";
import { MAX_USER_TURNS } from "../types.js";

const router = Router();

const ParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

router.get("/:sessionId", async (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  }

  res.json({
    persona: session.persona,
    turns: session.turns,
    turnNumber: session.turns.length,
    maxTurns: MAX_USER_TURNS,
    ended: session.endedReason,
    certificate: session.certificate,
  });
});

export default router;
