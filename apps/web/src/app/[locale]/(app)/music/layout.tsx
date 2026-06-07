import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел «editing»: общая панель вкладок сверху рабочей области. */
export default function SectionLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="editing" />
      {children}
    </>
  );
}
