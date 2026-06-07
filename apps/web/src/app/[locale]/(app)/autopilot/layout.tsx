import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел «autopilot»: общая панель вкладок сверху рабочей области. */
export default function SectionLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="autopilot" />
      {children}
    </>
  );
}
