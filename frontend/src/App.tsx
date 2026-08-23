import { useEffect, useRef, useState } from "react";
import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
import { generatePersona, getSessionState } from "./api";
import { identityProvider } from "./lib/identity";
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
      .catch(() => {
        // 서버 재시작(인메모리 폴백) 등으로 세션이 이미 사라진 경우 — 조용히 새로 시작
        clearActiveSessionId();
        setStage({ name: "input" });
      });
  }, []);

  // 앱인토스 네이티브 내비게이션 바의 뒤로가기 버튼(<)을 가로챈다. 등록하는 순간
  // 기본 뒤로가기 동작(그냥 닫히는 것)은 막히므로, 화면별 동작을 직접 정의해야 함
  // (비게임 출시 가이드: 최초 화면 뒤로가기 = 미니앱 종료, 그 외 = 이전 화면).
  useEffect(() => {
    const unsubscribe = graniteEvent.addEventListener("backEvent", {
      onEvent: () => {
        const current = stageRef.current;
        if (current.name === "input") {
          Screen.close();
          return;
        }
        if (current.name === "chat") {
          // 진행 중인 미션이 있으면 실수로 나가지 않도록 확인 — TDS 모달 사용
          setShowLeaveConfirm(true);
          return;
        }
        // restoring / loading / result — 잃을 진행상황이 없으니 바로 처음 화면으로
        leaveToInput();
      },
      onError: (err) => console.error("backEvent 처리 실패", err),
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leaveToInput() {
    activeRequestRef.current += 1; // 진행 중이던 handleStart의 결과를 무효화
    clearActiveSessionId();
    setShowLeaveConfirm(false);
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
      setStage({ name: "input" });
    }
  }

  return (
    <div className="app">
      {error && <p className="error top-error">{error}</p>}
      {stage.name === "restoring" && <LoadingScreen />}
      {stage.name === "input" && <InputScreen onSubmit={handleStart} />}
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
    </div>
  );
}
