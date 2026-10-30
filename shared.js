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

window.PhotoUtils = {
  clamp,
  drawImageToArea,
  triggerDownloadFromCanvas,
  safeNumber,
  setupDropzone
};
