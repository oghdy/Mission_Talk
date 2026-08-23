import { useState } from "react";
import { getHint, sendTurn } from "../api";
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
      setError(e instanceof Error ? e.message : "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
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
        <span className="turn-counter">
          {turnNumber} / {maxTurns} 턴
        </span>
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
          {hintLoading ? "..." : "💡 힌트"}
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
