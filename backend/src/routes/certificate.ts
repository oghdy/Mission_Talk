import { Router } from "express";
import { z } from "zod";
import { recordLlmError } from "../analytics.js";
import { badRequest, conflict, upstreamFailure } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { generateCertificate } from "../llm/certificate.js";
import { saveCertificate } from "../store.js";
import { requireSession } from "./sessionGuards.js";

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

    const session = await requireSession(parsed.data.sessionId);

    // 이미 채점된 세션이면(재접속 등) 다시 LLM 호출 없이 저장된 결과를 그대로 반환.
    if (session.certificate) {
      res.json(session.certificate);
      return;
    }

    if (session.turns.length === 0) {
      throw conflict("평가할 대화 기록이 없습니다.");
    }

    // 종료되지 않은 세션은 채점하지 않는다 (Phase 9 Task 27-7).
    // 수료증은 한 번 만들면 세션에 영구 저장되고 이후 재조회 시 그대로 반환되므로
    // (Task 13-3), 진행 중에 채점해버리면 남은 턴이 영영 반영되지 않은 수료증이
    // 고정된다. 현재 프론트엔드는 종료 후에만 호출하지만, 클라이언트 구현과 무관하게
    // API 자체가 이 불변식을 지키도록 서버에서 막는다.
    if (!session.endedReason) {
      throw conflict("아직 진행 중인 세션입니다.");
    }

    let certificate: Awaited<ReturnType<typeof generateCertificate>>;
    try {
      certificate = await generateCertificate(session);
    } catch (err) {
      recordLlmError({ endpoint: "certificate_generate", sessionId: session.id, error: err });
      throw upstreamFailure("수료증 생성에 실패했습니다.", err);
    }

    await saveCertificate(session, certificate);
    res.json(certificate);
  }),
);

export default router;
