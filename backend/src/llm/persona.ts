import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MAX_TOKENS, MODEL } from "./client.js";
import type { Difficulty, Language, Persona } from "../types.js";

const LANGUAGE_LABEL: Record<Language, string> = {
  en: "영어",
  ja: "일본어",
  zh: "중국어",
  es: "스페인어",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "하 (쉬운 어휘, 짧은 문장 위주로 상대방이 말함)",
  medium: "중 (일상 대화 수준 어휘, 힌트 없이 자연스러운 속도)",
  hard: "상 (고급 어휘/관용 표현 사용, 힌트 없음, 상대방이 쉽게 물러서지 않음)",
};

const PersonaSchema = z.object({
  personaPrompt: z
    .string()
    .describe(
      "역할극 내내 유지할 상대방 캐릭터의 시스템 프롬프트(한국어로 작성, 대상 언어로 대화하라는 지시 포함)",
    ),
  missionGoal: z.string().describe("사용자가 대화를 통해 달성해야 하는 구체적인 미션 목표 (한국어)"),
  openingLine: z.string().describe("대상 언어로 된 상대방의 첫 대사 (대화 시작 문장)"),
});

export async function generatePersonaAndMission(input: {
  language: Language;
  role: string;
  personality: string;
  difficulty: Difficulty;
}): Promise<Persona> {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS.persona,
    system:
      "당신은 외국어 회화 연습 미니앱 '미션톡'의 시나리오 생성기입니다. " +
      "사용자가 입력한 상대방 역할과 성격을 바탕으로, 최대 7턴 안에 클리어할 수 있는 " +
      "구체적이고 재미있는 롤플레잉 미션을 만듭니다. 부적절하거나 무관한 입력이 들어오면 " +
      "안전하고 무난한 카페/일상 상황으로 대체해서 생성하세요.",
    messages: [
      {
        role: "user",
        content:
          `언어: ${LANGUAGE_LABEL[input.language]}\n` +
          `상대방 역할: ${input.role}\n` +
          `성격: ${input.personality}\n` +
          `난이도: ${DIFFICULTY_LABEL[input.difficulty]}\n\n` +
          `위 조건으로 페르소나와 미션을 생성해줘. persona_prompt는 대화 내내 상대방이 ` +
          `${LANGUAGE_LABEL[input.language]}로만 답하도록 지시하고, 캐릭터를 벗어나지 말라는 ` +
          `내용을 포함해야 해. mission_goal은 사용자가 몇 턴 안에 달성해야 하는지 알 수 있게 ` +
          `구체적으로 작성해줘.`,
      },
    ],
    output_config: { format: zodOutputFormat(PersonaSchema), effort: "medium" },
  });

  if (!response.parsed_output) {
    throw new Error("페르소나 생성 결과를 파싱하지 못했습니다.");
  }
  return response.parsed_output;
}
