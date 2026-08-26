import type { CorsOptions } from "cors";

/**
 * CORS 허용 Origin 화이트리스트 (Phase 9 Task 26-2 / 27-4).
 *
 * 앱인토스 규정: 서버의 CORS 허용 Origin에 미니앱 Origin을 등록해야 한다.
 * SDK 3.x(우리가 쓰는 버전) 기준 웹뷰 미니앱 Origin은 아래 2개다.
 *   - 실제 서비스   : https://<appName>.web.tossmini.com
 *   - 콘솔 QR 테스트: https://<appName>.private-web.tossmini.com
 * SDK 1~2.x는 도메인이 다르지만 우리는 3.x만 쓰므로 3.x 기준만 등록한다.
 * 근거: https://developers-apps-in-toss.toss.im/documentation/integration/server-api
 *
 * 기존에는 `cors()`로 전 세계 모든 Origin을 허용하고 있었다.
 */

/** 콘솔 등록명(Step 15에서 "mission-talk"으로 확정). appName이 바뀌면 env로 덮어쓸 수 있다. */
const APP_NAME = process.env.APPS_IN_TOSS_APP_NAME ?? "mission-talk";

const TOSS_MINIAPP_ORIGINS = [
  `https://${APP_NAME}.web.tossmini.com`,
  `https://${APP_NAME}.private-web.tossmini.com`,
];

/** 로컬 개발용. Vite dev(5173)는 프록시라 CORS를 안 타지만, preview(4173)나 직접 접속은 탄다. */
const LOCAL_DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

/**
 * 비상용 확장 지점. 앱인토스가 도메인 규칙을 바꾸거나 새 테스트 환경이 생겼을 때,
 * 코드 배포 없이 Render 환경변수만으로 Origin을 추가할 수 있게 열어둔다.
 * 예) ALLOWED_ORIGINS="https://foo.example.com,https://bar.example.com"
 */
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

export const allowedOrigins = [
  ...TOSS_MINIAPP_ORIGINS,
  ...(isProduction ? [] : LOCAL_DEV_ORIGINS),
  ...EXTRA_ORIGINS,
];

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Origin 헤더가 없는 요청 = 브라우저가 보낸 크로스 오리진 요청이 아님
    // (curl, Render 헬스체크, 서버 간 호출 등). CORS는 브라우저 보호 장치라 여기서
    // 막을 이유가 없고, 막으면 헬스체크와 운영 점검이 깨진다.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // 거부는 조용히 넘어가지 않고 반드시 로그로 남긴다 — 앱인토스가 도메인 규칙을 바꿨을 때
    // "프로덕션에서만 전부 실패"하는 상황의 원인을 로그만 보고 바로 알 수 있어야 하기 때문.
    console.warn(`[cors] 허용되지 않은 Origin 차단: ${origin}`);
    callback(null, false);
  },
};
