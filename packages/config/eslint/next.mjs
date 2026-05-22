import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

import base from "./base.mjs";

/** Конфиг для Next.js-приложения. */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
