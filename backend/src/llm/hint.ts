import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client.js";
import type { Difficulty, Session } from "../types.js";

// persona.ts의 DIFFICULTY_LABEL과는 관점이 다름 — 저건 "상대방이 어떻게 말하는지",
// 이건 "사용자에게 추천할 문장이 어느 수준이어야 하는지"라 별도로 정의.
const HINT_DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "쉬운 기초 어휘와 짧고 간단한 문장 구조",
  medium: "일상 대화 수준의 어휘와 자연스러운 문장 구조",
  hard: "고급 어휘와 관용 표현을 적극적으로 활용한 문장",
};

const HintSchema = z.object({
  hintText: z.string().describe("사용자가 다음에 말하면 좋을, 약 2문장으로 구성된 대상 언어 예문"),
  hintTranslation: z.string().describe("hintText의 한국어 번역"),
});

export async function generateHint(
  session: Session,
): Promise<{ hintText: string; hintTranslation: string }> {
  const historyLines = session.turns.flatMap((t) => [
    `사용자: ${t.userText}`,
    `상대방: ${t.assistantText}`,
  ]);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 500,
    system:
      "당신은 외국어 회화 연습 앱의 학습 도우미입니다. 정답을 그대로 떠먹여주기보다, 사용자가 " +
      "다음 턴에 말하면 미션 진행에 도움이 될 만한 자연스러운 예문을 대상 언어로 제안하세요. " +
      "예문은 실제 대화에서 바로 써도 되는, 약 2문장으로 구성된 자연스러운 발화여야 합니다.\n" +
      `사용자가 선택한 난이도는 "${session.difficulty}"이고, 이 난이도에 맞는 문장 수준은: ` +
      `${HINT_DIFFICULTY_LABEL[session.difficulty]}. 예문의 어휘/문법 난이도를 여기에 맞춰주세요.`,
    messages: [
      {
        role: "user",
        content:
          `상대방 캐릭터 설정: ${session.persona.personaPrompt}\n\n` +
          `미션 목표: ${session.persona.missionGoal}\n\n` +
          (historyLines.length > 0 ? `[지금까지 대화]\n${historyLines.join("\n")}\n\n` : "") +
          `사용자가 다음에 할 말로 어떤 예문을 제안하면 좋을지 알려줘.`,
      },
    ],
    output_config: { format: zodOutputFormat(HintSchema), effort: "medium" },
  });

  if (!response.parsed_output) {
    throw new Error("힌트 생성 결과를 파싱하지 못했습니다.");
  }
  return response.parsed_output;
}
