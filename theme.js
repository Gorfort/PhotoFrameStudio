const storageKey = "photo-frame-studio-theme";
let memoryTheme = null;

function readThemePreference() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    if (memoryTheme === "light" || memoryTheme === "dark") {
      return memoryTheme;
    }
  }
  return null;
}

function writeThemePreference(theme) {
  memoryTheme = theme;
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Ignore storage failures (file:// and private-mode restrictions).
  }
}

function getInitialTheme() {
  const saved = readThemePreference();
  if (saved) {
    return saved;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  writeThemePreference(theme);

  const toggles = document.querySelectorAll("[data-theme-toggle]");
  for (const toggle of toggles) {
    toggle.textContent = theme === "dark" ? "Switch to light" : "Switch to dark";
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }
}

function initThemeToggle() {
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  const current = getInitialTheme();
  setTheme(current);
  requestAnimationFrame(() => {
    document.documentElement.setAttribute("data-theme-ready", "true");
  });

  if (!toggles.length) {
    return;
  }

  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      const activeTheme = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = activeTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
  }
}

initThemeToggle();
