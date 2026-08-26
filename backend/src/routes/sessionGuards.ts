import { conflict, notFound } from "../http/AppError.js";
import { getSession } from "../store.js";
import type { Session } from "../types.js";

/**
 * 세션 조회 + 존재 검증. 4개 라우트(chat/hint/certificate/session)가 똑같은 코드를
 * 각자 복사해서 갖고 있던 것을 한곳으로 모았다.
 *
 * 중요한 건 중복 제거 자체보다 **에러 전달 방식**이다. 기존에는 이 조회가 라우트의
 * try/catch 밖에 있어서, DB가 실패하면 응답 없이 프로세스가 죽었다(Task 25-1).
 * 이제는 throw로 실패를 알리고 asyncHandler → errorHandler가 받아서 처리하므로,
 * 호출하는 쪽이 try/catch를 잊어도 안전하다.
 */
export async function requireSession(sessionId: string): Promise<Session> {
  const session = await getSession(sessionId);
  if (!session) {
    throw notFound("세션을 찾을 수 없습니다.");
  }
  return session;
}

/** 아직 진행 중인 세션만 통과시킨다(턴 전송·힌트 요청 대상). */
export function requireActive(session: Session): Session {
  if (session.endedReason) {
    throw conflict("이미 종료된 세션입니다.");
  }
  return session;
}
