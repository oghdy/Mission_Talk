import { Router } from "express";
import { z } from "zod";
import { recordLlmError, recordMissionGenerationRequested } from "../analytics.js";
import { badRequest, upstreamFailure } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { generatePersonaAndMission } from "../llm/persona.js";
import { getCachedMission, saveMissionToCache } from "../missionCache.js";
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
  // "🎲 아무거나 골라줘" 버튼 사용 여부(분석용, Phase 10). 옵션 필드라 이 값을 아직
  // 안 보내는 프론트와도 호환됨 — 그 경우 recordMissionGenerationRequested에서 null로 기록.
  randomFill: z.boolean().nullish(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.flatten());
    }

    const { language, role, personality, difficulty, userKey, randomFill } = parsed.data;
    const cacheKey = { language, difficulty, role, personality };

    // 캐시 조회/저장은 fail-open으로 이미 설계돼 있어(missionCache.ts) 여기서 별도 방어 불필요.
    const cached = await getCachedMission(cacheKey);

    let persona = cached;
    if (!persona) {
      try {
        persona = await generatePersonaAndMission({ language, role, personality, difficulty });
      } catch (err) {
        recordLlmError({ endpoint: "persona_generate", sessionId: null, error: err });
        throw upstreamFailure("페르소나 생성에 실패했습니다.", err);
      }
      await saveMissionToCache(cacheKey, persona);
    }

    const session = await createSession({
      language,
      role,
      personality,
      difficulty,
      persona,
      userKey,
    });

    recordMissionGenerationRequested({
      sessionId: session.id,
      userKey: userKey ?? null,
      language,
      difficulty,
      role,
      personality,
      randomFill: randomFill ?? null,
      cacheHit: cached !== null,
    });

    res.json({ sessionId: session.id, persona });
  }),
);

export default router;
