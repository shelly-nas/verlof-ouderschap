import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";

import { CssBaseline, type PaletteMode, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { themeSettings, tokensFor } from "./theme";

const STORAGE_KEY = "theme-mode";

type ThemeModeContextValue = {
  mode: PaletteMode;
  /** null = volg de systeemvoorkeur. */
  preference: PaletteMode | null;
  setPreference: (mode: PaletteMode | null) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  preference: null,
  setPreference: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

function readPreference(): PaletteMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Aanvullingen op het gedeelde shelly-thema (theme.ts) die specifiek zijn voor
 * deze app. theme.ts zelf blijft gelijk aan de versie in shelly-fundamentals.
 */
function appOverrides(mode: PaletteMode) {
  const t = tokensFor(mode);
  return {
    components: {
      // Het label staat boven het veld; zonder notch loopt de rand door.
      MuiOutlinedInput: { defaultProps: { notched: false } },
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 8, borderRadius: 999, background: t.surface3 },
          bar: { borderRadius: 999 },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: 20, fontWeight: 600, padding: "24px 24px 8px" } } },
      MuiDialogContent: { styleOverrides: { root: { padding: "8px 24px" } } },
      MuiDialogActions: { styleOverrides: { root: { padding: 24, gap: 8 } } },
      MuiLink: { defaultProps: { underline: "hover" as const } },
    },
  };
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const [preference, setPreferenceState] = useState<PaletteMode | null>(readPreference);
  const mode: PaletteMode = preference ?? (prefersDark ? "dark" : "light");

  const theme = useMemo(() => createTheme(themeSettings(mode), appOverrides(mode)), [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", mode === "dark");
    root.classList.toggle("theme-light", mode === "light");
    root.style.background = tokensFor(mode).bg;
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        try {
          if (next) localStorage.setItem(STORAGE_KEY, next);
          else localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Zonder opslag geldt de keuze alleen voor deze sessie.
        }
      },
    }),
    [mode, preference],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
