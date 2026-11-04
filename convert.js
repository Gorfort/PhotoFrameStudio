(() => {
const { clamp, clampOffsetsToArea, drawImageToArea, safeNumber, setupDropzone, setupGridToggle, triggerDownloadFromCanvas } = window.PhotoUtils;

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/jpg", "image/pjpeg", "image/x-png"]);

function isSupportedImageFile(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (acceptedTypes.has(type)) {
    return true;
  }

  return /\.(jpe?g|png)$/.test(name);
}

function buildFileKey(file) {
  const name = String(file.name || "").toLowerCase();
  const size = Number(file.size || 0);
  const modified = Number(file.lastModified || 0);
  return `${name}::${size}::${modified}`;
}

const elements = {
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#fileInput"),
  fileNameText: document.querySelector("#fileNameText"),
  loadStatus: document.querySelector("#loadStatus"),
  activeStage: document.querySelector("#activeStage"),
  activeCanvas: document.querySelector("#activeCanvas"),
  selectedMeta: document.querySelector("#selectedMeta"),
  itemCount: document.querySelector("#itemCount"),
  gridToggle: document.querySelector("#gridToggle"),
  previewList: document.querySelector("#previewList"),
  emptyState: document.querySelector("#emptyState"),
  frameWidth: document.querySelector("#frameWidth"),
  frameHeight: document.querySelector("#frameHeight"),
  marginTopBottom: document.querySelector("#marginTopBottom"),
  marginSides: document.querySelector("#marginSides"),
  bgColor: document.querySelector("#bgColor"),
  fitMode: document.querySelector("#fitMode"),
  offsetX: document.querySelector("#offsetX"),
  offsetY: document.querySelector("#offsetY"),
  scale: document.querySelector("#scale"),
  edgeLock: document.querySelector("#edgeLock"),
  exportFormat: document.querySelector("#exportFormat"),
  jpegQuality: document.querySelector("#jpegQuality"),
  downloadSelected: document.querySelector("#downloadSelected"),
  downloadAll: document.querySelector("#downloadAll"),
  centerHorizontal: document.querySelector("#centerHorizontal"),
  centerVertical: document.querySelector("#centerVertical"),
  resetSelected: document.querySelector("#resetSelected"),
  clearAll: document.querySelector("#clearAll")
};

const state = {
  items: [],
  selectedId: null,
  lastMessage: "",
  dragging: false,
  lastPointerX: 0,
  lastPointerY: 0
};

const defaults = {
  frameWidth: 1080,
  frameHeight: 1350,
  topBottom: 20,
  sideMargin: 20,
  bgColor: "#ffffff",
  fitMode: "contain",
  edgeLock: false
};

let idCounter = 1;

function getConfig() {
  const frameWidth = clamp(safeNumber(elements.frameWidth.value, 1080), 200, 4000);
  const frameHeight = clamp(safeNumber(elements.frameHeight.value, 1350), 200, 4000);
  const topBottom = clamp(safeNumber(elements.marginTopBottom.value, 20), 0, frameHeight / 2 - 1);
  const sideMargin = clamp(safeNumber(elements.marginSides.value, 20), 0, frameWidth / 2 - 1);

  return {
    frameWidth,
    frameHeight,
    topBottom,
    sideMargin,
    bgColor: elements.bgColor.value || "#ffffff",
    fitMode: elements.fitMode.value || "contain",
    edgeLock: Boolean(elements.edgeLock?.checked)
  };
}

function getConfigForItem(item) {
  const frameWidth = clamp(safeNumber(item?.frameWidth, defaults.frameWidth), 200, 4000);
  const frameHeight = clamp(safeNumber(item?.frameHeight, defaults.frameHeight), 200, 4000);
  const topBottom = clamp(safeNumber(item?.topBottom, defaults.topBottom), 0, frameHeight / 2 - 1);
  const sideMargin = clamp(safeNumber(item?.sideMargin, defaults.sideMargin), 0, frameWidth / 2 - 1);
  const bgColor = item?.bgColor || defaults.bgColor;
  const fitMode = item?.fitMode || defaults.fitMode;
  const edgeLock = Boolean(item?.edgeLock);

  return {
    frameWidth,
    frameHeight,
    topBottom,
    sideMargin,
    bgColor,
    fitMode,
    edgeLock
  };
}

function getExportSettings() {
  const formatValue = String(elements.exportFormat?.value || "auto").toLowerCase();
  const jpegQuality = clamp(safeNumber(elements.jpegQuality?.value, 96), 70, 100);
  if (elements.jpegQuality) {
    elements.jpegQuality.value = String(Math.round(jpegQuality));
  }

  return {
    format: formatValue === "png" || formatValue === "jpeg" ? formatValue : "auto",
    quality: jpegQuality / 100
  };
}

function resolveExportTarget(originalFileName) {
  const settings = getExportSettings();
  const lowerName = String(originalFileName || "").toLowerCase();
  const sourceIsPng = lowerName.endsWith(".png");

  if (settings.format === "png" || (settings.format === "auto" && sourceIsPng)) {
    return { extension: "png", mime: "image/png", quality: settings.quality };
  }

  return { extension: "jpg", mime: "image/jpeg", quality: settings.quality };
}

function currentSelected() {
  return state.items.find((item) => item.id === state.selectedId) || null;
}

function createItem(file, image, fileKey) {
  const config = getConfig();
  return {
    id: `img-${Date.now()}-${idCounter++}`,
    file,
    fileKey,
    image,
    frameWidth: config.frameWidth,
    frameHeight: config.frameHeight,
    topBottom: config.topBottom,
    sideMargin: config.sideMargin,
    bgColor: config.bgColor,
    fitMode: config.fitMode,
    edgeLock: config.edgeLock,
    offsetX: 0,
    offsetY: 0,
    scale: 1
  };
}

function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = src;
  });
}

async function loadImageFromFile(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file);
      } catch {
        // Fall through to HTMLImageElement-based decoding.
      }
    }

    const image = await loadImageFromSource(objectUrl);
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch {
        // decode is optional here because onload already fired.
      }
    }
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function addFiles(files) {
  const validFiles = files.filter((file) => isSupportedImageFile(file));
  if (!validFiles.length) {
    state.lastMessage = "No supported image found. Please use JPG or PNG.";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = "Selection rejected: not a JPG/PNG image.";
    }
    if (elements.fileNameText) {
      elements.fileNameText.textContent = "No valid files selected.";
    }
    render();
    return;
  }

  const existingKeys = new Set(state.items.map((item) => item.fileKey));
  const queuedKeys = new Set();
  const filesToLoad = [];
  let skippedDuplicates = 0;

  for (const file of validFiles) {
    const fileKey = buildFileKey(file);
    if (existingKeys.has(fileKey) || queuedKeys.has(fileKey)) {
      skippedDuplicates += 1;
      continue;
    }
    queuedKeys.add(fileKey);
    filesToLoad.push({ file, fileKey });
  }

  if (!filesToLoad.length) {
    state.lastMessage = "All selected files are already loaded.";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = skippedDuplicates > 0
        ? `Skipped ${skippedDuplicates} duplicate file${skippedDuplicates === 1 ? "" : "s"}.`
        : "No new files to load.";
    }
    if (elements.fileNameText) {
      elements.fileNameText.textContent = "No new files selected.";
    }
    render();
    return;
  }

  if (elements.fileNameText) {
    const skippedText = skippedDuplicates > 0
      ? `, ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"} skipped`
      : "";
    elements.fileNameText.textContent = `${filesToLoad.length} file${filesToLoad.length === 1 ? "" : "s"} selected${skippedText}`;
  }

  let loadedCount = 0;
  let lastLoadedId = null;

  for (const entry of filesToLoad) {
    const { file, fileKey } = entry;
    try {
      if (elements.loadStatus) {
        elements.loadStatus.textContent = `Loading ${file.name}...`;
      }
      const image = await loadImageFromFile(file);
      const item = createItem(file, image, fileKey);
      state.items.push(item);
      lastLoadedId = item.id;
      loadedCount += 1;
    } catch (error) {
      console.error(error);
    }
  }

  if (loadedCount > 0) {
    state.selectedId = lastLoadedId;
    state.lastMessage = "";
    if (elements.loadStatus) {
      const skippedText = skippedDuplicates > 0
        ? ` Skipped ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"}.`
        : "";
      elements.loadStatus.textContent = `Loaded ${loadedCount} image${loadedCount === 1 ? "" : "s"}.${skippedText}`;
    }
  } else {
    state.lastMessage = "Could not decode this image in Firefox. Try saving as JPG or PNG and retry.";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = "Load failed: image decode error.";
    }
  }

  render();
}

function drawOutput(item, canvas) {
  const config = getConfigForItem(item);
  const innerHeight = Math.max(1, config.frameHeight - config.topBottom * 2);
  const contentMaxWidth = Math.max(1, config.frameWidth - config.sideMargin * 2);
  const contentArea = {
    x: config.sideMargin,
    y: config.topBottom,
    width: contentMaxWidth,
    height: innerHeight
  };

  canvas.width = config.frameWidth;
  canvas.height = config.frameHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawOptions = {
    fitMode: config.fitMode,
    scale: item.scale,
    offsetX: item.offsetX,
    offsetY: item.offsetY
  };

  if (config.edgeLock) {
    const clampedOffsets = clampOffsetsToArea(item.image, contentArea, drawOptions);
    drawOptions.offsetX = clampedOffsets.offsetX;
    drawOptions.offsetY = clampedOffsets.offsetY;
    item.offsetX = clampedOffsets.offsetX;
    item.offsetY = clampedOffsets.offsetY;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentArea.x, contentArea.y, contentArea.width, contentArea.height);
  ctx.clip();
  drawImageToArea(ctx, item.image, contentArea, drawOptions);
  ctx.restore();
}

function syncSelectedControls() {
  const selected = currentSelected();
  const disabled = !selected;

  elements.frameWidth.disabled = disabled;
  elements.frameHeight.disabled = disabled;
  elements.marginTopBottom.disabled = disabled;
  elements.marginSides.disabled = disabled;
  elements.bgColor.disabled = disabled;
  elements.fitMode.disabled = disabled;
  elements.offsetX.disabled = disabled;
  elements.offsetY.disabled = disabled;
  elements.scale.disabled = disabled;
  elements.edgeLock.disabled = disabled;
  elements.resetSelected.disabled = disabled;
  elements.centerHorizontal.disabled = disabled;
  elements.centerVertical.disabled = disabled;
  elements.downloadSelected.disabled = disabled;

  if (!selected) {
    return;
  }

  elements.frameWidth.value = String(Math.round(selected.frameWidth));
  elements.frameHeight.value = String(Math.round(selected.frameHeight));
  elements.marginTopBottom.value = String(Math.round(selected.topBottom));
  elements.marginSides.value = String(Math.round(selected.sideMargin));
  elements.bgColor.value = selected.bgColor;
  elements.fitMode.value = selected.fitMode;
  elements.offsetX.value = String(selected.offsetX);
  elements.offsetY.value = String(selected.offsetY);
  elements.scale.value = String(selected.scale);
  elements.edgeLock.checked = Boolean(selected.edgeLock);
}

function render() {
  elements.previewList.innerHTML = "";
  const hasItems = state.items.length > 0;
  elements.emptyState.classList.toggle("hidden", hasItems);
  elements.emptyState.textContent = state.lastMessage || "No images loaded yet.";
  elements.activeStage.classList.toggle("hidden", !hasItems);
  elements.previewList.classList.toggle("hidden", !hasItems);
  elements.downloadAll.disabled = !hasItems;
  elements.clearAll.disabled = !hasItems;
  elements.itemCount.textContent = `${state.items.length} image${state.items.length === 1 ? "" : "s"}`;

  const selected = currentSelected();
  if (selected) {
    drawOutput(selected, elements.activeCanvas);
    elements.selectedMeta.textContent = `${selected.file.name} · ${Math.round(selected.frameWidth)}x${Math.round(selected.frameHeight)} · ${Math.round(selected.scale * 100)}% zoom · X ${Math.round(selected.offsetX)} · Y ${Math.round(selected.offsetY)}`;
  } else {
    elements.selectedMeta.textContent = "No image selected.";
  }

  for (const item of state.items) {
    const wrapper = document.createElement("article");
    wrapper.className = "preview-item";
    if (item.id === state.selectedId) {
      wrapper.classList.add("selected");
    }

    const canvas = document.createElement("canvas");
    drawOutput(item, canvas);

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "preview-canvas-wrap";
    canvasWrap.append(canvas);

    const caption = document.createElement("div");
    caption.className = "preview-caption";
    caption.textContent = item.file.name;

    wrapper.append(canvasWrap, caption);
    wrapper.addEventListener("click", () => {
      state.selectedId = item.id;
      syncSelectedControls();
      render();
    });

    elements.previewList.append(wrapper);
  }

  syncSelectedControls();
}

function bindEvents() {
  setupGridToggle(elements.gridToggle);
  setupDropzone(elements.dropzone, elements.fileInput, addFiles);

  const sharedInputs = [
    elements.marginTopBottom,
    elements.marginSides,
    elements.bgColor,
    elements.fitMode
  ];
  for (const input of sharedInputs) {
    input.addEventListener("input", () => {
      const selected = currentSelected();
      if (!selected) {
        return;
      }

      selected.topBottom = clamp(safeNumber(elements.marginTopBottom.value, selected.topBottom), 0, selected.frameHeight / 2 - 1);
      selected.sideMargin = clamp(safeNumber(elements.marginSides.value, selected.sideMargin), 0, selected.frameWidth / 2 - 1);
      selected.bgColor = elements.bgColor.value || defaults.bgColor;
      selected.fitMode = elements.fitMode.value || defaults.fitMode;

      elements.marginTopBottom.value = String(Math.round(selected.topBottom));
      elements.marginSides.value = String(Math.round(selected.sideMargin));
      elements.bgColor.value = selected.bgColor;
      elements.fitMode.value = selected.fitMode;

      render();
    });
  }

  elements.edgeLock.addEventListener("change", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.edgeLock = Boolean(elements.edgeLock.checked);
    render();
  });

  const onExportInput = () => {
    getExportSettings();
  };
  elements.exportFormat.addEventListener("input", onExportInput);
  elements.jpegQuality.addEventListener("input", onExportInput);

  elements.frameWidth.addEventListener("input", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.frameWidth = clamp(safeNumber(elements.frameWidth.value, selected.frameWidth), 200, 4000);
    selected.sideMargin = clamp(selected.sideMargin, 0, selected.frameWidth / 2 - 1);
    elements.frameWidth.value = String(Math.round(selected.frameWidth));
    render();
  });

  elements.frameHeight.addEventListener("input", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.frameHeight = clamp(safeNumber(elements.frameHeight.value, selected.frameHeight), 200, 4000);
    selected.topBottom = clamp(selected.topBottom, 0, selected.frameHeight / 2 - 1);
    elements.frameHeight.value = String(Math.round(selected.frameHeight));
    render();
  });

  elements.offsetX.addEventListener("input", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.offsetX = safeNumber(elements.offsetX.value, 0);
    render();
  });

  elements.offsetY.addEventListener("input", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.offsetY = safeNumber(elements.offsetY.value, 0);
    render();
  });

  elements.scale.addEventListener("input", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.scale = clamp(safeNumber(elements.scale.value, 1), 0.2, 3);
    render();
  });

  elements.resetSelected.addEventListener("click", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.offsetX = 0;
    selected.offsetY = 0;
    selected.scale = 1;
    render();
  });

  elements.centerHorizontal.addEventListener("click", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.offsetX = 0;
    render();
  });

  elements.centerVertical.addEventListener("click", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    selected.offsetY = 0;
    render();
  });

  elements.clearAll.addEventListener("click", () => {
    state.items = [];
    state.selectedId = null;
    state.lastMessage = "";
    render();
  });

  elements.downloadSelected.addEventListener("click", () => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    const canvas = document.createElement("canvas");
    drawOutput(selected, canvas);
    const target = resolveExportTarget(selected.file.name);
    const baseName = selected.file.name.replace(/\.[^.]+$/, "");
    triggerDownloadFromCanvas(canvas, `${baseName}-framed.${target.extension}`, target.mime, { quality: target.quality });
  });

  elements.downloadAll.addEventListener("click", () => {
    for (const item of state.items) {
      const canvas = document.createElement("canvas");
      drawOutput(item, canvas);
      const target = resolveExportTarget(item.file.name);
      const baseName = item.file.name.replace(/\.[^.]+$/, "");
      triggerDownloadFromCanvas(canvas, `${baseName}-framed.${target.extension}`, target.mime, { quality: target.quality });
    }
  });

  elements.activeCanvas.addEventListener("pointerdown", (event) => {
    const selected = currentSelected();
    if (!selected) {
      return;
    }
    state.dragging = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    elements.activeCanvas.classList.add("dragging");
    elements.activeCanvas.setPointerCapture(event.pointerId);
  });

  elements.activeCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }
    const selected = currentSelected();
    if (!selected) {
      return;
    }

    const rect = elements.activeCanvas.getBoundingClientRect();
    const scaleX = elements.activeCanvas.width / rect.width;
    const scaleY = elements.activeCanvas.height / rect.height;
    const deltaX = (event.clientX - state.lastPointerX) * scaleX;
    const deltaY = (event.clientY - state.lastPointerY) * scaleY;

    selected.offsetX += deltaX;
    selected.offsetY += deltaY;

    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;

    elements.offsetX.value = String(clamp(selected.offsetX, -500, 500));
    elements.offsetY.value = String(clamp(selected.offsetY, -500, 500));
    selected.offsetX = safeNumber(elements.offsetX.value, 0);
    selected.offsetY = safeNumber(elements.offsetY.value, 0);

    render();
  });

  const stopDragging = (event) => {
    if (state.dragging && event?.pointerId !== undefined) {
      try {
        elements.activeCanvas.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    }
    state.dragging = false;
    elements.activeCanvas.classList.remove("dragging");
  };

  elements.activeCanvas.addEventListener("pointerup", stopDragging);
  elements.activeCanvas.addEventListener("pointercancel", stopDragging);
}

bindEvents();
render();
})();
