import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел «Автозалив», вкладка «Прогрев»: общая панель вкладок сверху. */
export default function WarmupLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="autopilot" />
      {children}
    </>
  );
}
