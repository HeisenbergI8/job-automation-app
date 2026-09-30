// Light or dark, chosen with the toggle in the top bar and remembered in this browser. Light is the
// default. THEME_SCRIPT runs inline in <head> so a dark page never flashes light on its way in.

const KEY = "job-automation:theme";

/** Kept in step with isDark() by hand: it runs before any module loads. */
export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("${KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

export function isDark() {
  return document.documentElement.classList.contains("dark");
}

export function setDark(dark: boolean) {
  try {
    if (dark) localStorage.setItem(KEY, "dark");
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the choice then lasts until reload.
  }
  document.documentElement.classList.toggle("dark", dark);
}
