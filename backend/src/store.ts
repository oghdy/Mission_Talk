import { randomUUID } from "node:crypto";
import { supabase } from "./supabase.js";
import type { Certificate, ChatTurnRecord, Session } from "./types.js";

interface SessionRow {
  id: string;
  user_key: string | null;
  language: Session["language"];
  difficulty: Session["difficulty"];
  role: string;
  personality: string;
  persona: Session["persona"];
  turns: ChatTurnRecord[];
  mission_complete: boolean;
  ended_reason: Session["endedReason"];
  certificate: Certificate | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userKey: row.user_key,
    language: row.language,
    difficulty: row.difficulty,
    role: row.role,
    personality: row.personality,
    persona: row.persona,
    turns: row.turns,
    missionComplete: row.mission_complete,
    endedReason: row.ended_reason,
    certificate: row.certificate,
  };
}

type NewSession = Pick<Session, "language" | "difficulty" | "role" | "personality" | "persona"> & {
  userKey?: string | null;
};

// Supabase 미설정 시 로컬 테스트용 인메모리 폴백.
const memorySessions = new Map<string, Session>();

export async function createSession(data: NewSession): Promise<Session> {
  const userKey = data.userKey ?? null;

  if (!supabase) {
    const session: Session = {
      ...data,
      id: randomUUID(),
      userKey,
      turns: [],
      missionComplete: false,
      endedReason: null,
      certificate: null,
    };
    memorySessions.set(session.id, session);
    return session;
  }

  const { data: row, error } = await supabase
    .from("mission_talk_sessions")
    .insert({
      user_key: userKey,
      language: data.language,
      difficulty: data.difficulty,
      role: data.role,
      personality: data.personality,
      persona: data.persona,
    })
    .select()
    .single();

  if (error || !row) {
    throw new Error(`세션 생성 실패: ${error?.message}`);
  }
  return rowToSession(row);
}

export async function getSession(id: string): Promise<Session | undefined> {
  if (!supabase) {
    return memorySessions.get(id);
  }

  const { data: row, error } = await supabase
    .from("mission_talk_sessions")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`세션 조회 실패: ${error.message}`);
  }
  return row ? rowToSession(row) : undefined;
}

export async function appendTurn(
  session: Session,
  turn: ChatTurnRecord,
  missionComplete: boolean,
  endedReason: Session["endedReason"],
): Promise<Session> {
  const turns = [...session.turns, turn];

  if (!supabase) {
    const updated: Session = { ...session, turns, missionComplete, endedReason };
    memorySessions.set(session.id, updated);
    return updated;
  }

  const { data: row, error } = await supabase
    .from("mission_talk_sessions")
    .update({ turns, mission_complete: missionComplete, ended_reason: endedReason })
    .eq("id", session.id)
    .select()
    .single();

  if (error || !row) {
    throw new Error(`턴 저장 실패: ${error?.message}`);
  }
  return rowToSession(row);
}

export async function saveCertificate(session: Session, certificate: Certificate): Promise<Session> {
  if (!supabase) {
    const updated: Session = { ...session, certificate };
    memorySessions.set(session.id, updated);
    return updated;
  }

  const { data: row, error } = await supabase
    .from("mission_talk_sessions")
    .update({ certificate })
    .eq("id", session.id)
    .select()
    .single();

  if (error || !row) {
    throw new Error(`수료증 저장 실패: ${error?.message}`);
  }
  return rowToSession(row);
}
