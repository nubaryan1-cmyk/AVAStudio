import { SectionTabs } from "../section-tabs";

import type { ReactNode } from "react";

/** Раздел «devices»: общая панель вкладок сверху рабочей области. */
export default function SectionLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <SectionTabs section="devices" />
      {children}
    </>
  );
}
