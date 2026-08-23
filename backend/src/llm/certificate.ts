import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client.js";
import type { Certificate, Session } from "../types.js";

// 5단계 확정 (Phase 4 Step 7). 좋은 순 -> 나쁜 순.
const GRADE_LABELS = ["완벽해요", "잘했어요", "그럭저럭이에요", "아쉬워요", "헉..."] as const;

const CertificateSchema = z.object({
  turns: z
    .array(
      z.object({
        userText: z.string(),
        grade: z.enum(GRADE_LABELS),
        comment: z
          .string()
          .nullable()
          .describe(
            "아쉬운 경우에만 개선 제안, 그렇지 않으면 null. 설명 자체는 한국어로 쓰되, 예시로 드는 " +
              "고친 문장만 대상 언어로 인용 (예: \"이렇게 말하면 더 자연스러워요: 'Can I get...'\")",
          ),
      }),
    )
    .describe("사용자가 친 문장 전체를 순서대로 평가한 목록"),
});

export async function generateCertificate(session: Session): Promise<Certificate> {
  const historyLines = session.turns.map(
    (t, i) => `${i + 1}턴 사용자 발화: ${t.userText}`,
  );

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system:
      "당신은 외국어 회화 연습 앱의 채점관입니다. 아래 미션 정보와 사용자의 발화 전체를 보고 " +
      "문장별로 등급을 매기고, 아쉬운 문장에는 더 자연스러운 표현을 제안하세요.\n" +
      "등급은 반드시 다음 5개 중 하나여야 하며, 기준은 다음과 같습니다:\n" +
      "- 완벽해요: 문법·어휘·자연스러움 모두 흠잡을 데 없는 문장\n" +
      "- 잘했어요: 문법적으로 괜찮고 전체적으로 무난하지만 조금만 다듬으면 더 좋아질 문장\n" +
      "- 그럭저럭이에요: 의미는 통하지만 잘했어요보다는 아쉬운, 그냥저냥한 문장\n" +
      "- 아쉬워요: 단어나 문법이 많이 틀린 문장\n" +
      "- 헉...: 의미가 거의 통하지 않거나 완전히 틀린 문장\n" +
      "채점 기준은 난이도와 무관하게 항상 동일하게 적용하세요 (난이도는 상대방이 얼마나 어려운 " +
      "표현을 쓰는지에만 영향을 주는 것이고, 사용자 문장의 정확성 기준을 낮추거나 높이면 안 됩니다).\n" +
      "이 앱은 한국 사용자가 외국어를 배우는 앱입니다. comment(개선 제안)의 설명 문장은 사용자가 " +
      "학습 중인 언어와 무관하게 항상 한국어로 작성하세요. 고친 문장 예시를 인용할 때만 대상 언어를 쓰고, " +
      "설명 자체를 대상 언어로 쓰지 마세요.",
    messages: [
      {
        role: "user",
        content:
          `언어: ${session.language}\n난이도: ${session.difficulty}\n` +
          `미션 목표: ${session.persona.missionGoal}\n\n` +
          `${historyLines.join("\n")}`,
      },
    ],
    output_config: { format: zodOutputFormat(CertificateSchema), effort: "medium" },
  });

  if (!response.parsed_output) {
    throw new Error("수료증 생성 결과를 파싱하지 못했습니다.");
  }

  return {
    turns: response.parsed_output.turns,
    missionCleared: session.missionComplete,
  };
}
