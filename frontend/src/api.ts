import type { Certificate, Difficulty, Hint, Language, Persona, SessionState, TurnResult } from "./types";

// 비워두면(로컬 dev) vite.config.ts 프록시를 통해 상대경로로 호출.
// 빌드된 미니앱은 백엔드와 다른 오리진(https://<appName>.web.tossmini.com)이라
// 절대 URL이 없으면 프로덕션에서 전부 404가 남 — 반드시 배포 전 값 채울 것.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function resolveUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ? JSON.stringify(err.error) : `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(resolveUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(resolveUrl(path));
  return handleResponse<T>(res);
}

export function generatePersona(input: {
  language: Language;
  role: string;
  personality: string;
  difficulty: Difficulty;
  userKey: string | null;
}): Promise<{ sessionId: string; persona: Persona }> {
  return postJSON("/persona/generate", input);
}

export function getSessionState(sessionId: string): Promise<SessionState> {
  return getJSON(`/chat/session/${sessionId}`);
}

export function sendTurn(sessionId: string, userText: string): Promise<TurnResult> {
  return postJSON("/chat/turn", { sessionId, userText });
}

export function generateCertificate(sessionId: string): Promise<Certificate> {
  return postJSON("/certificate/generate", { sessionId });
}

export function getHint(sessionId: string): Promise<Hint> {
  return postJSON("/chat/hint", { sessionId });
}
