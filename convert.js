(() => {
const { clamp, drawImageToArea, safeNumber, setupDropzone, triggerDownloadFromCanvas } = window.PhotoUtils;

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/jpg", "image/pjpeg", "image/x-png"]);

function isSupportedImageFile(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (acceptedTypes.has(type)) {
    return true;
  }

  return /\.(jpe?g|png)$/.test(name);
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
  previewList: document.querySelector("#previewList"),
  emptyState: document.querySelector("#emptyState"),
  frameWidth: document.querySelector("#frameWidth"),
  frameHeight: document.querySelector("#frameHeight"),
  marginTopBottom: document.querySelector("#marginTopBottom"),
  marginSides: document.querySelector("#marginSides"),
  bgColor: document.querySelector("#bgColor"),
  frameOverlay: document.querySelector("#frameOverlay"),
  fitMode: document.querySelector("#fitMode"),
  offsetX: document.querySelector("#offsetX"),
  offsetY: document.querySelector("#offsetY"),
  scale: document.querySelector("#scale"),
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

let idCounter = 1;

function getConfig() {
  const frameWidth = clamp(safeNumber(elements.frameWidth.value, 1080), 200, 4000);
  const frameHeight = clamp(safeNumber(elements.frameHeight.value, 1350), 200, 4000);
  const topBottom = clamp(safeNumber(elements.marginTopBottom.value, 20), 0, frameHeight / 2 - 1);
  const sideMargin = clamp(safeNumber(elements.marginSides.value, 20), 0, frameWidth / 2 - 1);
  const frameOverlay = clamp(safeNumber(elements.frameOverlay.value, 0), 0, Math.min(frameWidth, frameHeight) / 2);

  return {
    frameWidth,
    frameHeight,
    topBottom,
    sideMargin,
    frameOverlay,
    bgColor: elements.bgColor.value || "#ffffff",
    fitMode: elements.fitMode.value || "contain"
  };
}

function currentSelected() {
  return state.items.find((item) => item.id === state.selectedId) || null;
}

function createItem(file, image) {
  return {
    id: `img-${Date.now()}-${idCounter++}`,
    file,
    image,
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

  if (elements.fileNameText) {
    elements.fileNameText.textContent = `${validFiles.length} file${validFiles.length === 1 ? "" : "s"} selected`;
  }

  let loadedCount = 0;
  let lastLoadedId = null;

  for (const file of validFiles) {
    try {
      if (elements.loadStatus) {
        elements.loadStatus.textContent = `Loading ${file.name}...`;
      }
      const image = await loadImageFromFile(file);
      const item = createItem(file, image);
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
      elements.loadStatus.textContent = `Loaded ${loadedCount} image${loadedCount === 1 ? "" : "s"}.`;
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
  const config = getConfig();
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

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentArea.x, contentArea.y, contentArea.width, contentArea.height);
  ctx.clip();
  drawImageToArea(
    ctx,
    item.image,
    contentArea,
    {
      fitMode: config.fitMode,
      scale: item.scale,
      offsetX: item.offsetX,
      offsetY: item.offsetY
    }
  );
  ctx.restore();

  if (config.frameOverlay > 0) {
    const thickness = Math.floor(config.frameOverlay);
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, config.frameWidth, thickness);
    ctx.fillRect(0, config.frameHeight - thickness, config.frameWidth, thickness);
    ctx.fillRect(0, 0, thickness, config.frameHeight);
    ctx.fillRect(config.frameWidth - thickness, 0, thickness, config.frameHeight);
  }
}

function syncSelectedControls() {
  const selected = currentSelected();
  const disabled = !selected;

  elements.offsetX.disabled = disabled;
  elements.offsetY.disabled = disabled;
  elements.scale.disabled = disabled;
  elements.resetSelected.disabled = disabled;
  elements.centerHorizontal.disabled = disabled;
  elements.centerVertical.disabled = disabled;
  elements.downloadSelected.disabled = disabled;

  if (!selected) {
    return;
  }

  elements.offsetX.value = String(selected.offsetX);
  elements.offsetY.value = String(selected.offsetY);
  elements.scale.value = String(selected.scale);
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
    elements.selectedMeta.textContent = `${selected.file.name} · ${Math.round(selected.scale * 100)}% zoom · X ${Math.round(selected.offsetX)} · Y ${Math.round(selected.offsetY)}`;
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

    const caption = document.createElement("div");
    caption.className = "preview-caption";
    caption.textContent = item.file.name;

    wrapper.append(canvas, caption);
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
  setupDropzone(elements.dropzone, elements.fileInput, addFiles);

  const sharedInputs = [
    elements.frameWidth,
    elements.frameHeight,
    elements.marginTopBottom,
    elements.marginSides,
    elements.bgColor,
    elements.frameOverlay,
    elements.fitMode
  ];
  for (const input of sharedInputs) {
    input.addEventListener("input", render);
  }

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
    const extension = selected.file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
    const baseName = selected.file.name.replace(/\.[^.]+$/, "");
    triggerDownloadFromCanvas(canvas, `${baseName}-framed.${extension}`, extension === "png" ? "image/png" : "image/jpeg");
  });

  elements.downloadAll.addEventListener("click", () => {
    for (const item of state.items) {
      const canvas = document.createElement("canvas");
      drawOutput(item, canvas);
      const extension = item.file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const baseName = item.file.name.replace(/\.[^.]+$/, "");
      triggerDownloadFromCanvas(canvas, `${baseName}-framed.${extension}`, extension === "png" ? "image/png" : "image/jpeg");
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
