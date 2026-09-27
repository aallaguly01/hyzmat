/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_MOCK_TELEGRAM?: string;
  readonly VITE_DEV_BOT_TOKEN?: string;
  readonly VITE_MOCK_USER_ID?: string;
  readonly VITE_MOCK_USERNAME?: string;
  readonly VITE_MOCK_FIRST_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
