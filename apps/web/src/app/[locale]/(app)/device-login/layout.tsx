import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел Автозалива: вкладка «Вход» с живым экраном телефона. */
export default function SectionLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="autopilot" />
      {children}
    </>
  );
}
