import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

import base from "./base.mjs";

/** Корневой конфиг для линтинга всего монорепо из корня (используется lint-staged). */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
