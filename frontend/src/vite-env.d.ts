/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 배포된 백엔드의 절대 HTTPS URL. 비워두면(dev) vite.config.ts의 프록시를 통해 상대경로로 호출. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
