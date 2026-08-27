import { Router } from "express";
import { z } from "zod";
import { recordShareResult } from "../analytics.js";
import { badRequest } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";

/**
 * 프론트엔드가 직접 관찰한(백엔드는 알 수 없는) 클라이언트 사이드 이벤트를 보고하는 창구.
 * 지금은 공유 결과 하나뿐이지만, 다른 클라이언트 전용 이벤트가 생기면 이 라우터 밑에
 * `/events/foo` 식으로 추가하면 된다(index.ts에서 새 top-level mount가 필요 없음).
 *
 * 세션 존재 여부를 별도로 조회(requireSession)하지 않는다 — analytics_events.session_id의
 * FK 제약이 유효하지 않은 sessionId를 어차피 걸러내고, 그 실패는 analytics.ts의
 * fail-open 정책대로 조용히 로그만 남긴다. 이벤트 기록용 엔드포인트에 매 호출마다 세션
 * 조회 왕복을 추가할 이유가 없다.
 */
const router = Router();

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  outcome: z.enum(["toss", "web", "clipboard", "failed"]),
});

router.post(
  "/share",
  asyncHandler(async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.flatten());
    }

    recordShareResult(parsed.data);

    // 202: "접수"만 의미한다. 실제 저장 성공까지는 보장하지 않음(fail-open이라 여기서
    // 성공/실패를 구분해서 알려주지 않는다 — 알려주면 프론트가 재시도를 만들 유인이
    // 생기는데, 그러면 "이벤트 기록 실패가 사용자 흐름에 영향을 주면 안 된다"는
    // 원칙과 어긋난다).
    res.status(202).json({ ok: true });
  }),
);

export default router;
