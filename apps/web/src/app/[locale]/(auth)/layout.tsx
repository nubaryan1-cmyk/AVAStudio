import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";


export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Link href="/" className="mb-8 text-2xl font-bold">
        AVAStudio
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
