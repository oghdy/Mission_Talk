import { defineConfig } from "@apps-in-toss/web-framework/config";

// appName은 앱인토스 콘솔에 등록한 미니앱의 appName과 반드시 일치해야 함.
// 콘솔에 아직 미니앱을 등록하지 않아 임시값 사용 중 — 등록 후 교체 필요.
export default defineConfig({
  appName: "mission-talk",
  brand: {
    primaryColor: "#4f7cff",
  },
  permissions: [],
  navigationBar: {
    withBackButton: true,
    withTitle: true,
    theme: "light",
  },
  webBundleDir: "dist",
});
