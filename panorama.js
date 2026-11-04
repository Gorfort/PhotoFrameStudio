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
  selectedMeta: document.querySelector("#selectedMeta"),
  itemCount: document.querySelector("#itemCount"),
  gridToggle: document.querySelector("#gridToggle"),
  emptyState: document.querySelector("#emptyState"),
  stage: document.querySelector("#stage"),
  stripCanvas: document.querySelector("#stripCanvas"),
  framesList: document.querySelector("#framesList"),
  frameWidth: document.querySelector("#frameWidth"),
  frameHeight: document.querySelector("#frameHeight"),
  numFrames: document.querySelector("#numFrames"),
  border: document.querySelector("#border"),
  bgColor: document.querySelector("#bgColor"),
  fitMode: document.querySelector("#fitMode"),
  offsetX: document.querySelector("#offsetX"),
  offsetY: document.querySelector("#offsetY"),
  scale: document.querySelector("#scale"),
  edgeLock: document.querySelector("#edgeLock"),
  exportFormat: document.querySelector("#exportFormat"),
  jpegQuality: document.querySelector("#jpegQuality"),
  downloadAll: document.querySelector("#downloadAll"),
  downloadStrip: document.querySelector("#downloadStrip"),
  centerHorizontal: document.querySelector("#centerHorizontal"),
  centerVertical: document.querySelector("#centerVertical"),
  reset: document.querySelector("#reset"),
  clear: document.querySelector("#clear")
};

const state = {
  imageFile: null,
  imageFileKey: null,
  image: null,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  edgeLock: false,
  lastMessage: "",
  dragging: false,
  lastPointerX: 0,
  lastPointerY: 0
};

function getConfig() {
  const frameWidth = clamp(safeNumber(elements.frameWidth.value, 1080), 200, 4000);
  const frameHeight = clamp(safeNumber(elements.frameHeight.value, 1350), 200, 4000);
  const numFrames = clamp(safeNumber(elements.numFrames.value, 3), 2, 12);
  const border = clamp(safeNumber(elements.border.value, 20), 0, Math.min(frameWidth, frameHeight) / 2 - 1);

  return {
    frameWidth,
    frameHeight,
    numFrames,
    border,
    bgColor: elements.bgColor.value || "#ffffff",
    fitMode: elements.fitMode.value || "cover",
    edgeLock: Boolean(elements.edgeLock?.checked)
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

function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function loadImageFromFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement-based decoding.
    }
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    return await loadImageFromSource(dataUrl);
  } catch {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await loadImageFromSource(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function addFiles(files) {
  const firstValid = files.find((file) => isSupportedImageFile(file));
  if (!firstValid) {
    state.lastMessage = "No supported image found. Please use JPG or PNG.";
    if (elements.fileNameText) {
      elements.fileNameText.textContent = "No valid file selected.";
    }
    if (elements.loadStatus) {
      elements.loadStatus.textContent = "Selection rejected: not a JPG/PNG image.";
    }
    render();
    return;
  }

  const incomingKey = buildFileKey(firstValid);
  if (state.image && state.imageFileKey && state.imageFileKey === incomingKey) {
    state.lastMessage = "This image is already loaded.";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = `Skipped duplicate: ${firstValid.name} is already loaded.`;
    }
    if (elements.fileNameText) {
      elements.fileNameText.textContent = firstValid.name;
    }
    render();
    return;
  }

  try {
    if (elements.fileNameText) {
      elements.fileNameText.textContent = firstValid.name;
    }
    if (elements.loadStatus) {
      elements.loadStatus.textContent = `Loading ${firstValid.name}...`;
    }
    const image = await loadImageFromFile(firstValid);
    state.imageFile = firstValid;
    state.imageFileKey = incomingKey;
    state.image = image;
    state.offsetX = 0;
    state.offsetY = 0;
    state.scale = 1;
    state.lastMessage = "";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = `Loaded ${firstValid.name} (${firstValid.type || "unknown type"}).`;
    }
    render();
  } catch (error) {
    console.error(error);
    state.lastMessage = "Could not decode this image in Firefox. Try saving as JPG or PNG and retry.";
    if (elements.loadStatus) {
      elements.loadStatus.textContent = `Load failed for ${firstValid.name}: ${error?.message || "unknown error"}.`;
    }
    render();
  }
}

function drawStrip(canvas) {
  const config = getConfig();
  const totalWidth = config.frameWidth * config.numFrames;
  const totalHeight = config.frameHeight;
  const contentWidth = Math.max(1, totalWidth - config.border * 2);
  const contentHeight = Math.max(1, totalHeight - config.border * 2);
  const contentArea = {
    x: config.border,
    y: config.border,
    width: contentWidth,
    height: contentHeight
  };

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, totalWidth, totalHeight);
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  if (!state.image) {
    return;
  }

  const drawOptions = {
    fitMode: config.fitMode,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY
  };

  if (config.edgeLock) {
    const clampedOffsets = clampOffsetsToArea(state.image, contentArea, drawOptions);
    drawOptions.offsetX = clampedOffsets.offsetX;
    drawOptions.offsetY = clampedOffsets.offsetY;
    state.offsetX = clampedOffsets.offsetX;
    state.offsetY = clampedOffsets.offsetY;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentArea.x, contentArea.y, contentArea.width, contentArea.height);
  ctx.clip();
  drawImageToArea(ctx, state.image, contentArea, drawOptions);
  ctx.restore();
}

function sliceFrame(index) {
  const config = getConfig();
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = config.frameWidth;
  frameCanvas.height = config.frameHeight;

  const ctx = frameCanvas.getContext("2d");
  ctx.drawImage(
    elements.stripCanvas,
    index * config.frameWidth,
    0,
    config.frameWidth,
    config.frameHeight,
    0,
    0,
    config.frameWidth,
    config.frameHeight
  );

  return frameCanvas;
}

function renderFrames() {
  elements.framesList.innerHTML = "";
  if (!state.image) {
    return;
  }

  const config = getConfig();
  for (let index = 0; index < config.numFrames; index += 1) {
    const wrapper = document.createElement("article");
    wrapper.className = "preview-item";

    const frameCanvas = sliceFrame(index);
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "preview-canvas-wrap";
    canvasWrap.append(frameCanvas);

    const caption = document.createElement("div");
    caption.className = "preview-caption";
    caption.textContent = `Frame ${index + 1}`;

    wrapper.append(canvasWrap, caption);
    elements.framesList.append(wrapper);
  }
}

function render() {
  const config = getConfig();
  elements.stage.style.setProperty("--cut-count", String(config.numFrames));
  drawStrip(elements.stripCanvas);

  const hasImage = Boolean(state.image);
  elements.emptyState.classList.toggle("hidden", hasImage);
  elements.emptyState.textContent = state.lastMessage || "No panorama loaded yet.";
  elements.stage.classList.toggle("hidden", !hasImage);
  elements.downloadAll.disabled = !hasImage;
  elements.downloadStrip.disabled = !hasImage;
  elements.centerHorizontal.disabled = !hasImage;
  elements.centerVertical.disabled = !hasImage;
  elements.reset.disabled = !hasImage;
  elements.clear.disabled = !hasImage;
  elements.offsetX.disabled = !hasImage;
  elements.offsetY.disabled = !hasImage;
  elements.scale.disabled = !hasImage;
  elements.edgeLock.disabled = !hasImage;

  if (hasImage) {
    elements.offsetX.value = String(Math.round(state.offsetX));
    elements.offsetY.value = String(Math.round(state.offsetY));
    elements.edgeLock.checked = config.edgeLock;
    elements.selectedMeta.textContent = `${state.imageFile?.name || "panorama"} · ${Math.round(state.scale * 100)}% zoom · X ${Math.round(state.offsetX)} · Y ${Math.round(state.offsetY)}`;
    elements.itemCount.textContent = `${config.numFrames} frame${config.numFrames === 1 ? "" : "s"}`;
  } else {
    elements.edgeLock.checked = false;
    elements.selectedMeta.textContent = "No panorama selected.";
    elements.itemCount.textContent = "0 frames";
  }

  renderFrames();
}

function bindEvents() {
  setupGridToggle(elements.gridToggle);
  setupDropzone(elements.dropzone, elements.fileInput, addFiles);

  const sharedInputs = [
    elements.frameWidth,
    elements.frameHeight,
    elements.numFrames,
    elements.border,
    elements.bgColor,
    elements.fitMode,
    elements.edgeLock
  ];
  for (const input of sharedInputs) {
    input.addEventListener("input", render);
  }

  const onExportInput = () => {
    getExportSettings();
  };
  elements.exportFormat.addEventListener("input", onExportInput);
  elements.jpegQuality.addEventListener("input", onExportInput);

  elements.offsetX.addEventListener("input", () => {
    state.offsetX = safeNumber(elements.offsetX.value, 0);
    render();
  });

  elements.offsetY.addEventListener("input", () => {
    state.offsetY = safeNumber(elements.offsetY.value, 0);
    render();
  });

  elements.scale.addEventListener("input", () => {
    state.scale = clamp(safeNumber(elements.scale.value, 1), 0.2, 3);
    render();
  });

  elements.reset.addEventListener("click", () => {
    state.offsetX = 0;
    state.offsetY = 0;
    state.scale = 1;
    elements.offsetX.value = "0";
    elements.offsetY.value = "0";
    elements.scale.value = "1";
    render();
  });

  elements.centerHorizontal.addEventListener("click", () => {
    state.offsetX = 0;
    elements.offsetX.value = "0";
    render();
  });

  elements.centerVertical.addEventListener("click", () => {
    state.offsetY = 0;
    elements.offsetY.value = "0";
    render();
  });

  elements.clear.addEventListener("click", () => {
    state.image = null;
    state.imageFile = null;
    state.imageFileKey = null;
    state.lastMessage = "";
    if (elements.fileNameText) {
      elements.fileNameText.textContent = "No file selected.";
    }
    if (elements.loadStatus) {
      elements.loadStatus.textContent = "Waiting for image selection.";
    }
    elements.framesList.innerHTML = "";
    render();
  });

  elements.downloadStrip.addEventListener("click", () => {
    if (!state.image) {
      return;
    }
    const target = resolveExportTarget(state.imageFile?.name || "");
    const baseName = (state.imageFile?.name || "panorama").replace(/\.[^.]+$/, "");
    triggerDownloadFromCanvas(
      elements.stripCanvas,
      `${baseName}-strip.${target.extension}`,
      target.mime,
      { quality: target.quality }
    );
  });

  elements.downloadAll.addEventListener("click", () => {
    if (!state.image) {
      return;
    }

    const config = getConfig();
    const target = resolveExportTarget(state.imageFile?.name || "");
    const baseName = (state.imageFile?.name || "panorama").replace(/\.[^.]+$/, "");

    for (let index = 0; index < config.numFrames; index += 1) {
      const frameCanvas = sliceFrame(index);
      triggerDownloadFromCanvas(
        frameCanvas,
        `${baseName}-${index + 1}.${target.extension}`,
        target.mime,
        { quality: target.quality }
      );
    }
  });

  elements.stripCanvas.addEventListener("pointerdown", (event) => {
    if (!state.image) {
      return;
    }
    state.dragging = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    elements.stripCanvas.classList.add("dragging");
    elements.stripCanvas.setPointerCapture(event.pointerId);
  });

  elements.stripCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging || !state.image) {
      return;
    }

    const rect = elements.stripCanvas.getBoundingClientRect();
    const scaleX = elements.stripCanvas.width / rect.width;
    const scaleY = elements.stripCanvas.height / rect.height;

    state.offsetX += (event.clientX - state.lastPointerX) * scaleX;
    state.offsetY += (event.clientY - state.lastPointerY) * scaleY;

    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;

    elements.offsetX.value = String(clamp(state.offsetX, -1000, 1000));
    elements.offsetY.value = String(clamp(state.offsetY, -1000, 1000));
    state.offsetX = safeNumber(elements.offsetX.value, 0);
    state.offsetY = safeNumber(elements.offsetY.value, 0);

    render();
  });

  const stopDragging = (event) => {
    if (state.dragging && event?.pointerId !== undefined) {
      try {
        elements.stripCanvas.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    }
    state.dragging = false;
    elements.stripCanvas.classList.remove("dragging");
  };

  elements.stripCanvas.addEventListener("pointerup", stopDragging);
  elements.stripCanvas.addEventListener("pointercancel", stopDragging);
}

bindEvents();
render();
})();
