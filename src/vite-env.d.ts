/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ທີ່ຢູ່ api-bansi ລວມ /api — ເຊັ່ນ http://localhost:8888/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
