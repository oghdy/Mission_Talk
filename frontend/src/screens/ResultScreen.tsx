import { useEffect, useState } from "react";
import { generateCertificate } from "../api";
import { shareProvider } from "../lib/share";
import type { Certificate, Persona } from "../types";

function buildShareMessage(persona: Persona, ended: "cleared" | "max_turns"): string {
  return ended === "cleared"
    ? `미션톡에서 "${persona.missionGoal}" 미션을 클리어했어요! 나도 외국어로 롤플레잉 미션 도전해보기 🎯`
    : `미션톡에서 "${persona.missionGoal}" 미션에 도전했어요. 다음엔 클리어할 수 있을까요?`;
}

export function ResultScreen({
  sessionId,
  persona,
  ended,
  onRestart,
}: {
  sessionId: string;
  persona: Persona;
  ended: "cleared" | "max_turns";
  onRestart: () => void;
}) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    generateCertificate(sessionId)
      .then(setCertificate)
      .catch((e) => setError(e instanceof Error ? e.message : "수료증 생성에 실패했습니다."));
  }, [sessionId]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setShareNotice(null);
    try {
      const outcome = await shareProvider.share(buildShareMessage(persona, ended));
      if (outcome === "clipboard") {
        setShareNotice("공유 내용을 클립보드에 복사했어요.");
      } else if (outcome === "failed") {
        setShareNotice("공유에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="screen result-screen">
      <h1>{ended === "cleared" ? "미션 클리어!" : "미션 실패"}</h1>
      <p className="subtitle">
        {ended === "cleared"
          ? "수고하셨어요! 아래에서 턴별 평가를 확인해보세요."
          : "7턴 안에 미션을 달성하지 못했어요. 다시 도전해보세요."}
      </p>

      {error && <p className="error">{error}</p>}

      {!certificate && !error && <p>결과를 평가하는 중...</p>}

      {certificate && (
        <div className="certificate">
          {certificate.turns.map((t, i) => (
            <div key={i} className="certificate-turn">
              <p className="user-text">{t.userText}</p>
              <p className="grade">{t.grade}</p>
              {t.comment && <p className="comment">{t.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {shareNotice && <p className="share-notice">{shareNotice}</p>}

      <div className="result-actions">
        <button className="secondary" onClick={handleShare} disabled={sharing}>
          {sharing ? "..." : "공유하기"}
        </button>
        <button className="primary" onClick={onRestart}>
          다시 도전하기
        </button>
      </div>
    </div>
  );
}
