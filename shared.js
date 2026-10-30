function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawImageToArea(ctx, image, area, options) {
  const fitMode = options.fitMode || "contain";
  const offsetX = options.offsetX || 0;
  const offsetY = options.offsetY || 0;
  const userScale = options.scale || 1;

  const baseScale = fitMode === "cover"
    ? Math.max(area.width / image.width, area.height / image.height)
    : Math.min(area.width / image.width, area.height / image.height);

  const scaledWidth = image.width * baseScale * userScale;
  const scaledHeight = image.height * baseScale * userScale;

  const x = area.x + (area.width - scaledWidth) / 2 + offsetX;
  const y = area.y + (area.height - scaledHeight) / 2 + offsetY;

  ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
}

function triggerDownloadFromCanvas(canvas, fileName, mime = "image/png") {
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, mime);
}

function safeNumber(input, fallback) {
  const parsed = Number(input);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function setupDropzone(dropzone, fileInput, onFiles) {
  const handleFileList = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) {
      onFiles(files);
    }
  };

  fileInput.addEventListener("change", () => {
    handleFileList(fileInput.files);
    fileInput.value = "";
  });

  if (!dropzone) {
    return;
  }

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag-over");
    handleFileList(event.dataTransfer?.files);
  });
}

let memoryGridPreference = null;

function setupGridToggle(toggleButton, options = {}) {
  if (!toggleButton) {
    return;
  }

  const storageKey = options.storageKey || "photo-frame-studio-grid-visible";
  const root = document.documentElement;

  const readPreference = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "on" || raw === "off") {
        return raw;
      }
    } catch {
      if (memoryGridPreference === "on" || memoryGridPreference === "off") {
        return memoryGridPreference;
      }
    }
    return "on";
  };

  const writePreference = (value) => {
    memoryGridPreference = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Ignore storage failures.
    }
  };

  const apply = (value) => {
    const normalized = value === "off" ? "off" : "on";
    root.setAttribute("data-composition-grid", normalized);
    writePreference(normalized);
    toggleButton.textContent = normalized === "on" ? "Hide grid" : "Show grid";
    toggleButton.setAttribute("aria-pressed", String(normalized === "on"));
  };

  apply(readPreference());
  toggleButton.addEventListener("click", () => {
    const current = root.getAttribute("data-composition-grid") === "off" ? "off" : "on";
    apply(current === "on" ? "off" : "on");
  });
}

window.PhotoUtils = {
  clamp,
  drawImageToArea,
  triggerDownloadFromCanvas,
  safeNumber,
  setupDropzone,
  setupGridToggle
};
