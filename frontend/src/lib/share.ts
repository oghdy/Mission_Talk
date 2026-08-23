import { Share } from "@apps-in-toss/web-framework";

/** 실제로 어떤 방식으로 공유됐는지 — UI가 방식별로 다른 피드백을 보여줄 때 씀 (클립보드는 자체 UI가 없어 토스트 필요). */
export type ShareOutcome = "toss" | "web" | "clipboard" | "failed";

/**
 * "메시지 공유"라는 하나의 동작을, 실행 환경에 따라 다른 방식으로 수행한다.
 * identity.ts의 FallbackIdentityProvider와 동일한 폴백 체인 패턴 —
 * 앱인토스 WebView가 아니어도(로컬 브라우저 등) 최대한 동작하게 함.
 */
export interface ShareProvider {
  share(message: string): Promise<ShareOutcome>;
}

/** 앱인토스 네이티브 공유 시트. */
class TossShareProvider implements ShareProvider {
  async share(message: string): Promise<ShareOutcome> {
    try {
      await Share.sendMessage({ message });
      return "toss";
    } catch {
      return "failed";
    }
  }
}

/** 브라우저 표준 Web Share API (모바일 사파리/크롬 등). */
class WebShareProvider implements ShareProvider {
  async share(message: string): Promise<ShareOutcome> {
    if (!navigator.share) return "failed";
    try {
      await navigator.share({ text: message });
      return "web";
    } catch (e) {
      // 사용자가 공유 시트를 직접 닫은 경우(AbortError)는 "실패"가 아니라
      // 의도된 취소이므로, 클립보드 등 다음 폴백으로 넘어가지 않고 그대로 종료.
      if (e instanceof DOMException && e.name === "AbortError") return "web";
      return "failed";
    }
  }
}

/** 최후 폴백 — 클립보드 복사. */
class ClipboardShareProvider implements ShareProvider {
  async share(message: string): Promise<ShareOutcome> {
    try {
      await navigator.clipboard.writeText(message);
      return "clipboard";
    } catch {
      return "failed";
    }
  }
}

class FallbackShareProvider implements ShareProvider {
  constructor(private readonly providers: ShareProvider[]) {}

  async share(message: string): Promise<ShareOutcome> {
    for (const provider of this.providers) {
      const outcome = await provider.share(message);
      if (outcome !== "failed") return outcome;
    }
    return "failed";
  }
}

export const shareProvider: ShareProvider = new FallbackShareProvider([
  new TossShareProvider(),
  new WebShareProvider(),
  new ClipboardShareProvider(),
]);
