export type Language = "en" | "ja" | "zh" | "es";
export type Difficulty = "easy" | "medium" | "hard";

export interface Persona {
  personaPrompt: string;
  missionGoal: string;
  openingLine: string;
}

export interface ChatMessage {
  speaker: "user" | "persona";
  text: string;
}

export interface TurnResult {
  replyText: string;
  missionComplete: boolean;
  turnNumber: number;
  maxTurns: number;
  ended: "cleared" | "max_turns" | null;
}

export interface CertificateTurn {
  userText: string;
  grade: string;
  comment: string | null;
}

export interface Certificate {
  turns: CertificateTurn[];
  missionCleared: boolean;
  // optional: Phase 8 이전에 생성돼 캐시된 수료증엔 이 필드가 없음
  overallComment?: string;
}

export interface Hint {
  hintText: string;
  hintTranslation: string;
}

export interface ChatTurnRecord {
  userText: string;
  assistantText: string;
}

export interface SessionState {
  persona: Persona;
  turns: ChatTurnRecord[];
  turnNumber: number;
  maxTurns: number;
  ended: "cleared" | "max_turns" | null;
  certificate: Certificate | null;
}
