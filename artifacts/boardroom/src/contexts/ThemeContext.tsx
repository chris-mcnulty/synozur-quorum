import { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "aurora" | "baseline";
export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (t: ThemeName) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "aurora",
  mode: "light",
  setTheme: () => {},
  toggleMode: () => {},
});

const STORAGE_KEY_THEME = "quorum-theme";
const STORAGE_KEY_MODE = "quorum-mode";

function readStorage<T extends string>(key: string, fallback: T, allowed: T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    if (v && allowed.includes(v)) return v;
  } catch {}
  return fallback;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    readStorage<ThemeName>(STORAGE_KEY_THEME, "aurora", ["aurora", "baseline"])
  );
  const [mode, setModeState] = useState<ThemeMode>(() =>
    readStorage<ThemeMode>(STORAGE_KEY_MODE, "light", ["light", "dark"])
  );

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    if (mode === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme, mode]);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY_THEME, t); } catch {}
  };

  const toggleMode = () => {
    setModeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem(STORAGE_KEY_MODE, next); } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
