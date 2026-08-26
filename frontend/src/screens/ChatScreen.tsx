import { useState } from "react";
import { getHint, getSessionState, NetworkError, sendTurn } from "../api";
import { PixelHintIcon } from "../components/PixelHintIcon";
import type { ChatMessage, ChatTurnRecord, Hint, Persona } from "../types";

function buildInitialMessages(persona: Persona, initialTurns: ChatTurnRecord[]): ChatMessage[] {
  return [
    { speaker: "persona", text: persona.openingLine },
    ...initialTurns.flatMap((t): ChatMessage[] => [
      { speaker: "user", text: t.userText },
      { speaker: "persona", text: t.assistantText },
    ]),
  ];
}

export function ChatScreen({
  sessionId,
  persona,
  initialTurns,
  onEnded,
}: {
  sessionId: string;
  persona: Persona;
  initialTurns: ChatTurnRecord[];
  onEnded: (ended: "cleared" | "max_turns") => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => buildInitialMessages(persona, initialTurns));
  const [input, setInput] = useState("");
  const [turnNumber, setTurnNumber] = useState(initialTurns.length);
  const [maxTurns, setMaxTurns] = useState(7);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setHint(null);
    setMessages((prev) => [...prev, { speaker: "user", text }]);
    setInput("");

    try {
      const result = await sendTurn(sessionId, text);
      setMessages((prev) => [...prev, { speaker: "persona", text: result.replyText }]);
      setTurnNumber(result.turnNumber);
      setMaxTurns(result.maxTurns);
      if (result.ended) {
        onEnded(result.ended);
      }
    } catch (e) {
      // 클라이언트가 응답을 못 받았을 뿐, 서버는 실제로 턴 처리를 끝냈을 수 있다
      // (타임아웃·연결 끊김). 서버가 명확히 실패를 응답한 경우(HttpError)는 재동기화할
      // 이유가 없으므로 NetworkError일 때만 시도한다.
      if (e instanceof NetworkError && (await resyncAfterNetworkFailure())) {
        // 실제로는 성공한 것으로 확인됨 — 에러를 보여주지 않는다.
      } else {
        setError(e instanceof Error ? e.message : "메시지 전송에 실패했습니다.");
      }
    } finally {
      setSending(false);
    }
  }

  /**
   * 서버가 알고 있는 최신 상태로 화면을 다시 맞춘다. 부분 패치 대신 항상 전체
   * 메시지 목록을 재구성하는 이유: 낙관적으로 먼저 넣어둔 사용자 말풍선과 서버
   * 응답 사이에 불일치·중복이 생길 여지를 원천 차단하기 위함(App.tsx의 세션
   * 복원 로직과 동일한 원칙).
   *
   * @returns 서버 턴 수가 실제로 늘어 있어서(=진짜로 성공해서) 재동기화했으면 true
   */
  async function resyncAfterNetworkFailure(): Promise<boolean> {
    try {
      const state = await getSessionState(sessionId);
      if (state.turnNumber <= turnNumber) {
        return false; // 서버도 이 턴을 못 받았음 — 진짜 실패
      }
      setMessages(buildInitialMessages(persona, state.turns));
      setTurnNumber(state.turnNumber);
      setMaxTurns(state.maxTurns);
      if (state.ended) {
        onEnded(state.ended);
      }
      return true;
    } catch {
      return false; // 재동기화 시도 자체도 실패 — 원래 에러를 그대로 보여준다
    }
  }

  async function handleHint() {
    if (hintLoading || sending) return;
    setHintLoading(true);
    setError(null);
    try {
      setHint(await getHint(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "힌트 생성에 실패했습니다.");
    } finally {
      setHintLoading(false);
    }
  }

  return (
    <div className="screen chat-screen">
      <div className="chat-header">
        <p className="mission-goal">{persona.missionGoal}</p>
        <div className="turn-gauge" role="img" aria-label={`${turnNumber} / ${maxTurns} 턴`}>
          {Array.from({ length: maxTurns }, (_, i) => (
            <span key={i} className={`turn-gauge-block ${i < turnNumber ? "filled" : ""}`} />
          ))}
        </div>
      </div>

      <div className="message-list">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.speaker}`}>
            {m.text}
          </div>
        ))}
        {sending && <div className="bubble persona pending">...</div>}
      </div>

      {error && <p className="error">{error}</p>}

      {hint && (
        <div className="hint-box">
          <p className="hint-text">{hint.hintText}</p>
          <p className="hint-translation">{hint.hintTranslation}</p>
        </div>
      )}

      <div className="composer">
        <button
          type="button"
          className="secondary hint-button"
          onClick={handleHint}
          disabled={hintLoading || sending}
        >
          {hintLoading ? (
            "..."
          ) : (
            <>
              <PixelHintIcon /> 힌트
            </>
          )}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="메시지를 입력하세요"
          disabled={sending}
          maxLength={500}
        />
        <button className="primary" onClick={handleSend} disabled={sending || !input.trim()}>
          전송
        </button>
      </div>
    </div>
  );
}
