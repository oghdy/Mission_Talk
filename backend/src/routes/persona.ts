import { Router } from "express";
import { z } from "zod";
import { generatePersonaAndMission } from "../llm/persona.js";
import { createSession } from "../store.js";
import { DIFFICULTIES, LANGUAGES } from "../types.js";

const router = Router();

const RequestSchema = z.object({
  language: z.enum(LANGUAGES),
  role: z.string().min(1).max(100),
  personality: z.string().min(1).max(100),
  difficulty: z.enum(DIFFICULTIES),
  // 앱인토스 User.getAnonymousKey() hash (또는 로컬 개발 폴백 UUID). 없으면 익명 세션.
  userKey: z.string().min(1).max(200).nullish(),
});

router.post("/", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { language, role, personality, difficulty, userKey } = parsed.data;

  try {
    const persona = await generatePersonaAndMission({ language, role, personality, difficulty });
    const session = await createSession({ language, role, personality, difficulty, persona, userKey });
    res.json({
      sessionId: session.id,
      persona,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "페르소나 생성에 실패했습니다." });
  }
});

export default router;
