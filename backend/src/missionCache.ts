import { supabase } from "./supabase.js";
import type { Difficulty, Language, Persona } from "./types.js";

// (언어, 난이도, 상대방, 성격) 조합당 이만큼 쌓이면 새로 생성하지 않고 풀에서
// 랜덤으로 재사용한다. 값을 늘리면 반복감은 줄지만 절감 효과가 늦게 나타나고,
// 줄이면 반대 — 트래픽 보고 튜닝할 여지를 남겨두려고 상수로 분리해둠.
export const MISSION_CACHE_POOL_SIZE = 5;

export interface MissionCacheKey {
  language: Language;
  difficulty: Difficulty;
  role: string;
  personality: string;
}

// 완전일치 매칭이라 "카페 직원" vs "카페 알바생"처럼 사람이 보기엔 같아도 문자열이
// 다르면 별개 캐시로 취급됨 — 의도된 동작. 랜덤 채우기 버튼처럼 정해진 문구를
// 반복해서 쓰는 경우에만 자연히 캐시가 쌓이고, 직접 타이핑한 조합은 사실상 항상
// 새로 생성됨(자유입력에는 항상 신선한 미션을 주는 게 맞다고 판단).
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 캐시 풀이 아직 안 찼으면 null(=새로 생성해야 함), 다 찼으면 랜덤으로 하나 골라 반환. */
export async function getCachedMission(key: MissionCacheKey): Promise<Persona | null> {
  if (!supabase) return null; // 인메모리 모드는 재시작하면 어차피 날아가서 캐싱 의미 없음 — 스킵

  const { data, error } = await supabase
    .from("mission_cache")
    .select("persona")
    .eq("language", key.language)
    .eq("difficulty", key.difficulty)
    .eq("role_key", normalize(key.role))
    .eq("personality_key", normalize(key.personality));

  if (error) {
    // 캐시는 최적화일 뿐 핵심 기능이 아님 — 조회 실패해도 그냥 새로 생성하는 쪽으로 넘어감.
    console.warn("미션 캐시 조회 실패, 새로 생성으로 대체:", error.message);
    return null;
  }
  if (!data || data.length < MISSION_CACHE_POOL_SIZE) return null;

  return data[Math.floor(Math.random() * data.length)].persona as Persona;
}

/** 새로 생성한 미션을 풀에 추가. 실패해도 사용자 흐름은 막지 않음(그냥 다음에도 새로 생성될 뿐). */
export async function saveMissionToCache(key: MissionCacheKey, persona: Persona): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("mission_cache").insert({
    language: key.language,
    difficulty: key.difficulty,
    role_key: normalize(key.role),
    personality_key: normalize(key.personality),
    role_raw: key.role,
    personality_raw: key.personality,
    persona,
  });

  if (error) {
    console.warn("미션 캐시 저장 실패(치명적이지 않음):", error.message);
  }
}
