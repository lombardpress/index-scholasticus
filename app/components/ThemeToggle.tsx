"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. The initial theme is applied before paint by the inline
// no-flash script in layout.tsx; here we just read it back and let the user flip
// it, persisting the choice in localStorage.

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as "light" | "dark" | null) ||
      "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };

  return (
    <button id="theme-toggle" onClick={toggle}>
      Toggle theme
    </button>
  );
}
