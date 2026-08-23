import { User } from "@apps-in-toss/web-framework";

/**
 * 사용자를 식별하는 키를 얻는 방법을 추상화한다. 실행 환경(실제 토스 WebView
 * vs 로컬 브라우저 개발)에 따라 다른 전략을 쓰되, 호출부는 항상 동일한
 * 인터페이스만 알면 됨.
 */
export interface IdentityProvider {
  getUserKey(): Promise<string | null>;
}

/** 앱인토스 WebView 안에서만 동작 — 비게임 카테고리 전용 API. */
class TossAnonymousKeyProvider implements IdentityProvider {
  async getUserKey(): Promise<string | null> {
    try {
      const result = await User.getAnonymousKey();
      return result.hash;
    } catch {
      // 토스 WebView가 아니거나(브릿지 없음), 앱 버전이 낮거나, 알 수 없는 오류.
      return null;
    }
  }
}

/** 로컬 브라우저 개발용 폴백 — 기기에 저장된 UUID를 재사용. */
class LocalDevIdentityProvider implements IdentityProvider {
  private readonly storageKey = "missiontalk_dev_user_key";

  async getUserKey(): Promise<string | null> {
    try {
      let key = localStorage.getItem(this.storageKey);
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem(this.storageKey, key);
      }
      return key;
    } catch {
      return null;
    }
  }
}

/** 순서대로 시도하다 첫 성공값을 반환 — 새 환경(예: 실제 로그인)이 추가돼도 배열에 끼워넣기만 하면 됨. */
class FallbackIdentityProvider implements IdentityProvider {
  constructor(private readonly providers: IdentityProvider[]) {}

  async getUserKey(): Promise<string | null> {
    for (const provider of this.providers) {
      const key = await provider.getUserKey();
      if (key) return key;
    }
    return null;
  }
}

export const identityProvider: IdentityProvider = new FallbackIdentityProvider([
  new TossAnonymousKeyProvider(),
  new LocalDevIdentityProvider(),
]);
