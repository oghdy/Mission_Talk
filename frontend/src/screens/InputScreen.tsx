import { useEffect, useState } from "react";
import { warmUpBackend } from "../api";
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
  // 이 값이 "🎲 아무거나 골라줘"로 채워진 그대로 제출됐는지 (Phase 13 Task 38-1).
  randomFill: boolean;
}

export function InputScreen({
  onSubmit,
  initialValue,
}: {
  onSubmit: (value: InputValue) => void;
  // 직전 시도가 실패해서 이 화면으로 돌아온 경우, 그때 입력했던 값을 이어서 채워둔다.
  initialValue?: InputValue | null;
}) {
  const [language, setLanguage] = useState<Language>(initialValue?.language ?? "en");
  const [role, setRole] = useState(initialValue?.role ?? "");
  const [personality, setPersonality] = useState(initialValue?.personality ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initialValue?.difficulty ?? "medium");
  // initialValue가 있어도(=직전 시도가 실패해서 복원된 값) 이 플래그는 항상 false로
  // 시작한다 — 복원된 값은 이미 한 번 실패해서 다시 손댈 값이라 "랜덤 채우기 그대로"로
  // 보기 애매하기 때문(Phase 13 Task 38-1).
  const [randomFill, setRandomFill] = useState(false);

  // 사용자가 상대방/성격을 입력하는 동안 백엔드를 미리 깨워둔다. 콜드스타트(22.6초)를
  // "미션 시작하기" 이후의 대기 시간에서 빼내는 게 목적 — 결과는 기다리지 않는다.
  useEffect(() => {
    warmUpBackend();
  }, []);

  const canSubmit = role.trim().length > 0 && personality.trim().length > 0;

  function handleRandomFill() {
    setRole(pickRandom(ROLE_SAMPLES));
    setPersonality(pickRandom(PERSONALITY_SAMPLES));
    setRandomFill(true);
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
          onChange={(e) => {
            setRole(e.target.value);
            setRandomFill(false); // 랜덤으로 채운 뒤 한 글자라도 고치면 더 이상 "그대로"가 아님
          }}
          placeholder="예: 카페 직원"
          maxLength={100}
        />
      </label>

      <label>
        성격
        <input
          value={personality}
          onChange={(e) => {
            setPersonality(e.target.value);
            setRandomFill(false);
          }}
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
        onClick={() => onSubmit({ language, role, personality, difficulty, randomFill })}
      >
        미션 시작하기
      </button>
    </div>
  );
}
