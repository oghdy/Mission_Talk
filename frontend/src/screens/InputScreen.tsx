import { useState } from "react";
import logo from "../assets/logo_96.png";
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

// 순수 역할만 — 성격 형용사는 안 섞음 (성격은 별도 입력란 몫).
const ROLE_SAMPLES = [
  "카페 직원",
  "면접관",
  "소개팅 상대",
  "편의점 알바생",
  "택시 기사",
  "헬스 트레이너",
  "호텔 프런트 직원",
  "여행 가이드",
  "미용실 디자이너",
  "옆집 이웃",
  "신입사원 동기",
  "룸메이트",
  "애견카페 직원",
  "공항 체크인 직원",
  "중고거래 판매자",
];

const PERSONALITY_SAMPLES = [
  "친절함",
  "까칠함",
  "츤데레",
  "무뚝뚝함",
  "유머러스함",
  "수다스러움",
  "시크함",
  "다정함",
  "무심함",
  "열정적임",
  "새침함",
];

function pickRandom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

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

  function handleRandomFill() {
    setRole(pickRandom(ROLE_SAMPLES));
    setPersonality(pickRandom(PERSONALITY_SAMPLES));
  }

  return (
    <div className="screen input-screen">
      <img src={logo} alt="" className="input-screen-logo" />
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
          placeholder="예: 카페 직원"
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

      <button type="button" className="secondary random-fill-button" onClick={handleRandomFill}>
        🎲 아무거나 골라줘
      </button>

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
