import globals from "globals";

import base from "./base.mjs";

/** Конфиг для Node-пакетов и воркера. */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
];
