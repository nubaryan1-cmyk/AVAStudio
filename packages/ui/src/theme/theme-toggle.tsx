"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "../components/button.js";

import { useTheme } from "./theme-provider.js";

/** Кнопка переключения light/dark. */
export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Переключить тему" onClick={toggleTheme}>
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
