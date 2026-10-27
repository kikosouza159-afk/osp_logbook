"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("osp_theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme,setTheme] = useState<Theme>("light");
  const [ready,setReady] = useState(false);

  useEffect(() => {
    const current = getTheme();
    setTheme(current);
    applyTheme(current);
    setReady(true);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem("osp_theme")) return;
      const next: Theme = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change",onSystemChange);
    return () => media.removeEventListener("change",onSystemChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("osp_theme",next);
    applyTheme(next);
  }

  const dark = theme === "dark";

  return <button
    className="theme-toggle"
    type="button"
    onClick={toggle}
    aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    title={dark ? "Modo claro" : "Modo escuro"}
    data-ready={ready ? "1" : "0"}
  >
    <span className="theme-toggle-track" aria-hidden="true">
      <span className="theme-toggle-thumb">
        {dark ? <Moon size={14}/> : <Sun size={14}/>}
      </span>
      <Sun className="theme-toggle-sun" size={13}/>
      <Moon className="theme-toggle-moon" size={13}/>
    </span>
    <span className="theme-toggle-label">{dark ? "Escuro" : "Claro"}</span>
  </button>;
}
