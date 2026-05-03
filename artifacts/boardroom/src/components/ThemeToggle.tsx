import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemeName } from "@/contexts/ThemeContext";

const THEMES: { id: ThemeName; label: string }[] = [
  { id: "aurora", label: "Aurora" },
  { id: "baseline", label: "Baseline" },
];

export function ThemeToggle() {
  const { mode, theme, toggleMode, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* Light / Dark toggle */}
      <button
        onClick={toggleMode}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Toggle dark mode"
      >
        {mode === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      {/* Theme selector pill */}
      <div className="hidden sm:flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={[
              "px-2 py-1 text-[10px] font-medium uppercase tracking-wider rounded-sm transition-colors",
              theme === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
