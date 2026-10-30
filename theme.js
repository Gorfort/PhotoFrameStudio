const storageKey = "photo-frame-studio-theme";
let memoryTheme = null;

function readThemeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("theme");
    if (value === "light" || value === "dark") {
      return value;
    }
  } catch {
    // Ignore URL parsing issues.
  }
  return null;
}

function updateThemeLinks(theme) {
  const links = document.querySelectorAll("a[href]");
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    let parsed;
    try {
      parsed = new URL(href, window.location.href);
    } catch {
      continue;
    }

    if (parsed.origin !== window.location.origin) {
      continue;
    }

    parsed.searchParams.set("theme", theme);

    const isSameOrigin = parsed.origin === window.location.origin;
    const isRelative = !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href);
    const nextHref = (isSameOrigin && isRelative)
      ? `${parsed.pathname.split("/").pop() || ""}${parsed.search}${parsed.hash}`
      : parsed.toString();

    link.setAttribute("href", nextHref);
  }
}

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
  const fromUrl = readThemeFromUrl();
  if (fromUrl) {
    return fromUrl;
  }

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
  updateThemeLinks(theme);

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("theme", theme);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore history/state update failures.
  }

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
