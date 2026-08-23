import { Router } from "express";
import { z } from "zod";
import { generateCertificate } from "../llm/certificate.js";
import { getSession, saveCertificate } from "../store.js";

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
  if (session.turns.length === 0) {
    return res.status(409).json({ error: "평가할 대화 기록이 없습니다." });
  }

  // 이미 채점된 세션이면(재접속 등) 다시 LLM 호출 없이 저장된 결과를 그대로 반환.
  if (session.certificate) {
    return res.json(session.certificate);
  }

  try {
    const certificate = await generateCertificate(session);
    await saveCertificate(session, certificate);
    res.json(certificate);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "수료증 생성에 실패했습니다." });
  }
});

export default router;
