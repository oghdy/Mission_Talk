import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../http/AppError.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { MAX_USER_TURNS } from "../types.js";
import { requireSession } from "./sessionGuards.js";

const router = Router();

const ParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

router.get(
  "/:sessionId",
  asyncHandler(async (req, res) => {
    const parsed = ParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw badRequest(parsed.error.flatten());
    }

    const session = await requireSession(parsed.data.sessionId);

    res.json({
      persona: session.persona,
      turns: session.turns,
      turnNumber: session.turns.length,
      maxTurns: MAX_USER_TURNS,
      ended: session.endedReason,
      certificate: session.certificate,
    });
  }),
);

export default router;
