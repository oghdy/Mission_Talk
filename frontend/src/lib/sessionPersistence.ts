// 미니앱을 종료했다가 다시 들어와도 진행 중이던 대화/결과 화면을 잃지 않도록
// 활성 세션 id만 로컬에 저장해둔다. 실제 대화 내용/등급은 항상 서버(GET
// /chat/session/:id)에서 다시 받아오므로, 여기엔 최소한의 포인터만 둔다.
const STORAGE_KEY = "missiontalk_active_session_id";

export function saveActiveSessionId(sessionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 세션 복원 기능만 조용히 빠짐
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearActiveSessionId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
