// 서버와의 통신이 "일시적으로 한 번 실패한 것"인지 "계속 안 되는 상태"인지를
// 구분하기 위해 연속 실패 횟수만 추적한다. 앱인토스 비게임 가이드가 권장하는
// "통신이 끊기면 알럿 노출 + 종료 로직"(긴급 점검 설정하기 문서)의 발동 조건.
//
// 화면마다 따로 세지 않고 여기 한 곳에 모은 이유: 실패는 세션 복원(App)·대화
// (ChatScreen)·수료증(ResultScreen) 어디서나 나는데, 안내 모달은 앱 전체에서
// 한 번만 떠야 하기 때문.

// 1회 실패로는 띄우지 않는다. 일시적 실패는 흔하고 세션은 서버에 저장돼 있어서
// 사용자가 그냥 다시 시도하면 되는데, 첫 실패마다 전면 모달이 뜨면 오히려 방해가
// 된다(다크패턴 방지 정책의 "예상하지 못한 인터럽트"와도 상충).
const FAILURE_THRESHOLD = 2;

let consecutiveFailures = 0;
const listeners = new Set<() => void>();

/** 네트워크 계층 실패(연결 불가·타임아웃). 서버가 응답한 4xx/5xx는 여기 해당 안 됨. */
export function reportNetworkFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    listeners.forEach((listener) => listener());
  }
}

/** 응답을 받았다는 건 네트워크가 살아있다는 뜻이므로 카운터를 리셋한다. */
export function reportNetworkSuccess(): void {
  consecutiveFailures = 0;
}

/** 사용자가 안내를 닫은 뒤 곧바로 다시 뜨지 않도록 카운터를 비운다. */
export function resetConnectionHealth(): void {
  consecutiveFailures = 0;
}

export function subscribeToConnectionTrouble(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
