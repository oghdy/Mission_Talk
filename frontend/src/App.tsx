import { useEffect, useRef, useState } from "react";
import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
import { generatePersona, getSessionState, HttpError } from "./api";
import { identityProvider } from "./lib/identity";
import { resetConnectionHealth, subscribeToConnectionTrouble } from "./lib/connectionHealth";
import { clearActiveSessionId, loadActiveSessionId, saveActiveSessionId } from "./lib/sessionPersistence";
import { ConfirmModal } from "./components/ConfirmModal";
import { InputScreen, type InputValue } from "./screens/InputScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { ResultScreen } from "./screens/ResultScreen";
import type { ChatTurnRecord, Persona } from "./types";

type Stage =
  | { name: "restoring" }
  | { name: "input" }
  | { name: "loading" }
  | { name: "chat"; sessionId: string; persona: Persona; initialTurns: ChatTurnRecord[] }
  | { name: "result"; sessionId: string; persona: Persona; ended: "cleared" | "max_turns" };

export default function App() {
  // 첫 렌더는 항상 "복원 중" — 마운트 시 활성 세션이 있었는지 확인 후 화면을 결정한다.
  const [stage, setStage] = useState<Stage>({ name: "restoring" });
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showConnectionTrouble, setShowConnectionTrouble] = useState(false);
  // 미션 생성이 실패해서 입력 화면으로 돌아왔을 때 그대로 이어 채우기 위한 기억값.
  // leaveToInput()에서 의도적으로 비움 — 안 비우면 완전히 새로 시작하는 사용자에게
  // 예전에 실패했던 낡은 값이 뜬금없이 채워짐.
  const [lastFailedInput, setLastFailedInput] = useState<InputValue | null>(null);

  // graniteEvent 리스너는 마운트 시 한 번만 등록하므로, 콜백 안에서 최신 stage를
  // 읽으려면 ref가 필요함(그렇지 않으면 등록 시점의 stage로 클로저가 고정됨).
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // "로딩 중" 상태에서 뒤로가기로 이탈한 뒤 원래 요청이 뒤늦게 성공해도
  // 화면을 덮어쓰지 않도록 막는 가드.
  const activeRequestRef = useRef(0);

  useEffect(() => {
    const sessionId = loadActiveSessionId();
    if (!sessionId) {
      setStage({ name: "input" });
      return;
    }

    getSessionState(sessionId)
      .then((state) => {
        if (state.ended) {
          setStage({ name: "result", sessionId, persona: state.persona, ended: state.ended });
        } else {
          setStage({ name: "chat", sessionId, persona: state.persona, initialTurns: state.turns });
        }
      })
      .catch((e) => {
        // 세션 포인터는 "이 id가 확실히 못 쓴다"고 확인됐을 때만 버린다.
        //   4xx  = 세션이 없거나(404) id가 잘못됨 → 버리는 게 맞음
        //   5xx·네트워크 실패 = 서버/연결의 일시적 문제, 세션은 살아있을 수 있음 → 유지
        // 구분 없이 지우면 잠깐 연결이 끊긴 사용자가 진행 중이던 미션을 영영 잃는다.
        if (e instanceof HttpError && e.status < 500) {
          clearActiveSessionId();
        }
        setStage({ name: "input" });
      });
  }, []);

  // 연속 통신 실패가 임계값을 넘으면 안내 모달을 띄운다. 화면별로 흩어 넣지 않고
  // 앱 레벨에서 한 번만 구독 — 실패는 복원/대화/수료증 어디서나 발생한다.
  useEffect(() => subscribeToConnectionTrouble(() => setShowConnectionTrouble(true)), []);

  // 앱인토스 네이티브 내비게이션 바의 뒤로가기 버튼(<)을 가로챈다. 등록하는 순간
  // 기본 뒤로가기 동작(그냥 닫히는 것)은 막히므로, 화면별 동작을 직접 정의해야 함
  // (비게임 출시 가이드: 최초 화면 뒤로가기 = 미니앱 종료, 그 외 = 이전 화면).
  //
  // 실제 토스 WebView가 아닌 곳(로컬 프리뷰, 프로덕션 빌드를 브라우저로 직접 열람 등)에서는
  // graniteEvent.addEventListener가 등록 즉시 동기적으로 throw함 — dev 모드에서는
  // @apps-in-toss/devtools의 mock이 이 호출을 가로채서 문제가 안 드러나지만, mock이
  // 꺼지는 프로덕션 빌드(vite build)에서는 그대로 터져서 앱 전체가 하얗게 죽는 걸
  // 실제로 확인함(Step 16). identity.ts/share.ts와 동일하게 try/catch로 방어.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = graniteEvent.addEventListener("backEvent", {
        onEvent: () => {
          const current = stageRef.current;
          if (current.name === "input") {
            Screen.close();
            return;
          }
          if (current.name === "chat") {
            // 진행 중인 미션이 있으면 실수로 나가지 않도록 확인 모달을 띄움
            setShowLeaveConfirm(true);
            return;
          }
          // restoring / loading / result — 잃을 진행상황이 없으니 바로 처음 화면으로
          leaveToInput();
        },
        onError: (err) => console.error("backEvent 처리 실패", err),
      });
    } catch (err) {
      // 앱인토스 WebView가 아닌 환경 — 네이티브 뒤로가기 자체가 없으니 조용히 무시
      console.warn("graniteEvent 등록 불가(앱인토스 WebView 환경이 아님)", err);
    }
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissConnectionTrouble() {
    setShowConnectionTrouble(false);
    resetConnectionHealth(); // 닫자마자 다시 뜨지 않도록 카운터를 비움
  }

  // 앱인토스 권장: 자체 서버와 통신이 끊기면 알럿 노출 + 미니앱 종료 로직 제공
  // (긴급 점검 설정하기 문서). WebView 밖에서는 Screen.close가 throw하므로 방어(Step 16).
  function closeMiniApp() {
    dismissConnectionTrouble();
    try {
      Screen.close();
    } catch (err) {
      console.warn("Screen.close 불가(앱인토스 WebView 환경이 아님)", err);
    }
  }

  function leaveToInput() {
    activeRequestRef.current += 1; // 진행 중이던 handleStart의 결과를 무효화
    clearActiveSessionId();
    setShowLeaveConfirm(false);
    setLastFailedInput(null); // 새로 시작하는 것이므로 이전 실패 기억은 버림
    setStage({ name: "input" });
  }

  async function handleStart(value: InputValue) {
    const requestId = ++activeRequestRef.current;
    setStage({ name: "loading" });
    setError(null);
    try {
      const userKey = await identityProvider.getUserKey();
      const { sessionId, persona } = await generatePersona({ ...value, userKey });
      if (activeRequestRef.current !== requestId) return; // 그 사이 뒤로가기로 이탈함
      saveActiveSessionId(sessionId);
      setStage({ name: "chat", sessionId, persona, initialTurns: [] });
    } catch (e) {
      if (activeRequestRef.current !== requestId) return;
      setError(e instanceof Error ? e.message : "미션 생성에 실패했습니다.");
      setLastFailedInput(value); // 입력 화면이 다시 마운트될 때 이 값으로 이어 채움
      setStage({ name: "input" });
    }
  }

  return (
    <div className="app">
      {error && <p className="error top-error">{error}</p>}
      {stage.name === "restoring" && <LoadingScreen />}
      {stage.name === "input" && <InputScreen onSubmit={handleStart} initialValue={lastFailedInput} />}
      {stage.name === "loading" && <LoadingScreen />}
      {stage.name === "chat" && (
        <ChatScreen
          sessionId={stage.sessionId}
          persona={stage.persona}
          initialTurns={stage.initialTurns}
          onEnded={(ended) =>
            setStage({ name: "result", sessionId: stage.sessionId, persona: stage.persona, ended })
          }
        />
      )}
      {stage.name === "result" && (
        <ResultScreen
          sessionId={stage.sessionId}
          persona={stage.persona}
          ended={stage.ended}
          onRestart={leaveToInput}
        />
      )}

      <ConfirmModal
        open={showLeaveConfirm}
        title="진행 중인 미션을 나가시겠어요?"
        description="지금 나가면 이어서 진행할 수 없어요."
        confirmLabel="나가기"
        cancelLabel="계속하기"
        onConfirm={leaveToInput}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      {/* 나가기 확인 모달이 떠 있으면 겹쳐 띄우지 않는다(오버레이 중첩 방지). */}
      <ConfirmModal
        open={showConnectionTrouble && !showLeaveConfirm}
        title="서버와 연결이 불안정해요"
        description="잠시 후 다시 시도하거나, 미니앱을 종료했다가 다시 들어와 주세요. 진행 중인 미션은 저장돼 있어요."
        confirmLabel="종료하기"
        cancelLabel="닫기"
        onConfirm={closeMiniApp}
        onCancel={dismissConnectionTrouble}
      />
    </div>
  );
}
