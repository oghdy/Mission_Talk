import { useState } from "react";
import type { Difficulty, Language } from "../types";

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "영어" },
  { value: "ja", label: "일본어" },
  { value: "zh", label: "중국어" },
  { value: "es", label: "스페인어" },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "하" },
  { value: "medium", label: "중" },
  { value: "hard", label: "상" },
];

export interface InputValue {
  language: Language;
  role: string;
  personality: string;
  difficulty: Difficulty;
}

export function InputScreen({
  onSubmit,
}: {
  onSubmit: (value: InputValue) => void;
}) {
  const [language, setLanguage] = useState<Language>("en");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const canSubmit = role.trim().length > 0 && personality.trim().length > 0;

  return (
    <div className="screen input-screen">
      <h1>미션톡</h1>
      <p className="subtitle">상대방/성격/난이도를 정하고 7턴 안에 미션을 클리어해보세요.</p>

      <label>
        언어
        <div className="chip-row">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`chip ${language === opt.value ? "selected" : ""}`}
              onClick={() => setLanguage(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </label>

      <label>
        상대방
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예: 까칠한 카페 직원"
          maxLength={100}
        />
      </label>

      <label>
        성격
        <input
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="예: 츤데레"
          maxLength={100}
        />
      </label>

      <label>
        난이도
        <div className="chip-row">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`chip ${difficulty === opt.value ? "selected" : ""}`}
              onClick={() => setDifficulty(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </label>

      <button
        className="primary"
        disabled={!canSubmit}
        onClick={() => onSubmit({ language, role, personality, difficulty })}
      >
        미션 시작하기
      </button>
    </div>
  );
}
