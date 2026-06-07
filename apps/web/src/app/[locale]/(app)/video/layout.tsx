import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел «AI-Генерация»: вкладки Генерация · Медиатека · Видео. */
export default function SectionLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="generate" />
      {children}
    </>
  );
}
