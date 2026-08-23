import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client.js";
import type { Session } from "../types.js";

const TurnResultSchema = z.object({
  replyText: z.string().describe("상대방 캐릭터로서 대상 언어로 작성한 답변 (캐릭터를 유지)"),
  missionComplete: z.boolean().describe("이번 사용자 발화까지 반영했을 때 미션 목표를 달성했는지 여부"),
});

export async function processTurn(
  session: Session,
  userText: string,
): Promise<{ replyText: string; missionComplete: boolean }> {
  // 세션 내내 고정인 페르소나/미션 정의는 system에 두고 캐싱 — 매 턴 동일한 프리픽스라
  // 두 번째 턴부터는 이 부분이 캐시에서 읽혀서 과금되지 않음.
  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text:
        `${session.persona.personaPrompt}\n\n` +
        `미션 목표: ${session.persona.missionGoal}\n` +
        `대화 기록을 참고해서, 사용자의 새 발화에 캐릭터를 유지한 채 대상 언어로 답하고, ` +
        `이 발화까지 포함했을 때 미션이 달성되었는지 판정해줘.\n` +
        `답변(replyText)은 반드시 1~3문장 이내로 짧게 유지해줘. 긴 설명, 여러 문단, 장황한 부연 설명은 금지.`,
      cache_control: { type: "ephemeral" },
    },
  ];

  // 실제 멀티턴 메시지 배열로 구성 — 매턴 히스토리를 텍스트로 통째로 다시 보내지 않음.
  // 직전까지의 대화(새 사용자 발화 이전)에 캐시 경계를 찍어서, 턴이 늘어날수록
  // 캐시로 재활용되는 비중이 커지도록 함.
  const history: Anthropic.MessageParam[] = session.turns.flatMap((turn, i) => {
    const isLastTurn = i === session.turns.length - 1;
    return [
      { role: "user", content: turn.userText },
      {
        role: "assistant",
        content: isLastTurn
          ? [{ type: "text", text: turn.assistantText, cache_control: { type: "ephemeral" } }]
          : turn.assistantText,
      },
    ] satisfies Anthropic.MessageParam[];
  });

  const response = await anthropic.messages.parse({
    model: MODEL,
    // Sonnet 5는 기본적으로 적응형 thinking이 켜져 있고, 이 thinking 토큰도 max_tokens
    // 예산을 같이 씀. 600으로 좁혀뒀더니(Step 7) 사고 과정이 길어지는 경우 JSON이
    // 중간에 잘려서 파싱 에러가 났음(실사용 중 발견, 특히 스페인어에서 재현).
    // 응답 길이 자체는 위 system 지시(1~3문장)로 이미 통제되므로, max_tokens는
    // thinking 여유분을 감안해 넉넉하게 둠 — 폭주 방지용 하드 캡 목적이 아님.
    max_tokens: 2000,
    system,
    messages: [...history, { role: "user", content: userText }],
    output_config: { format: zodOutputFormat(TurnResultSchema), effort: "medium" },
  });

  if (!response.parsed_output) {
    throw new Error("턴 처리 결과를 파싱하지 못했습니다.");
  }
  return response.parsed_output;
}
