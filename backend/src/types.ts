export const LANGUAGES = ["en", "ja", "zh", "es"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MAX_USER_TURNS = 7;

export interface Persona {
  personaPrompt: string;
  missionGoal: string;
  openingLine: string;
}

export interface ChatTurnRecord {
  userText: string;
  assistantText: string;
}

export interface CertificateTurn {
  userText: string;
  grade: string;
  comment: string | null;
}

export interface Certificate {
  turns: CertificateTurn[];
  missionCleared: boolean;
}

export interface Session {
  id: string;
  userKey: string | null;
  language: Language;
  difficulty: Difficulty;
  role: string;
  personality: string;
  persona: Persona;
  turns: ChatTurnRecord[];
  missionComplete: boolean;
  endedReason: "cleared" | "max_turns" | null;
  certificate: Certificate | null;
}
