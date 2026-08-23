import { Router } from "express";
import { z } from "zod";
import { generateHint } from "../llm/hint.js";
import { getSession } from "../store.js";

const router = Router();

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
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
    const hint = await generateHint(session);
    res.json(hint);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "힌트 생성에 실패했습니다." });
  }
});

export default router;
