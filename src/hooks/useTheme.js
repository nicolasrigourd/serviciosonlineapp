import { useCallback, useEffect, useState } from "react";
import { clienteDb } from "../db/clienteDb";

const CONFIG_KEY = "theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  useEffect(() => {
    clienteDb.config.get(CONFIG_KEY)
      .then((record) => {
        if (record?.value) {
          applyTheme(record.value);
          setThemeState(record.value);
        } else {
          // Primera vez: usar preferencia del sistema, pero default dark
          const system = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          applyTheme(system);
          setThemeState(system);
          clienteDb.config.put({ key: CONFIG_KEY, value: system }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((value) => {
    const html = document.documentElement;
    html.setAttribute("data-theme-transitioning", "");
    applyTheme(value);
    setThemeState(value);
    clienteDb.config.put({ key: CONFIG_KEY, value }).catch(() => {});
    setTimeout(() => html.removeAttribute("data-theme-transitioning"), 320);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
