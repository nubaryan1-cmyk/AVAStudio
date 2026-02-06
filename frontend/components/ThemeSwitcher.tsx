"use client";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (!mounted) return null;

  return (
    <select 
      value={theme} 
      onChange={(e) => setTheme(e.target.value)}
      className="p-2 border rounded bg-secondary text-foreground text-sm"
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="cyber">Cyber</option>
    </select>
  );
}
