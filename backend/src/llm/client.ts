import Anthropic from "@anthropic-ai/sdk";

// 자격 증명은 ANTHROPIC_API_KEY 환경변수 또는 `ant auth login` 프로필에서 자동 해석됨.
export const anthropic = new Anthropic();

// 롤플레잉 대사 생성 + 구조화된 판정 수준의 작업에는 Sonnet 5로 충분하고, 속도/비용 면에서
// "5분 내 완결" 원칙에도 더 잘 맞음. 수료증 채점(특히 일본어/중국어 뉘앙스 평가)의 정확도가
// 실측 결과 아쉬우면 그 부분만 claude-opus-5로 올리는 것을 고려할 것.
export const MODEL = "claude-sonnet-5";
