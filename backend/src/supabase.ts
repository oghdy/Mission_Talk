import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 백엔드 전용 서비스 롤 키 사용 — 프론트엔드에는 절대 노출하지 않음.
// 값이 없으면 null — store.ts가 인메모리 저장소로 폴백함 (로컬 테스트용).
export const supabase: SupabaseClient | null =
  url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;

if (!supabase) {
  console.warn(
    "[store] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — 세션을 인메모리로 저장합니다 (서버 재시작 시 사라짐).",
  );
}
