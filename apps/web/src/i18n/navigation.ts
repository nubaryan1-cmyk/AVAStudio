import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing.js";

/** Локале-осведомлённые обёртки навигации (Link/redirect/usePathname/useRouter). */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
