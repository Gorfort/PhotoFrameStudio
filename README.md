# Photo Frame Studio

A desktop-first web app for preparing images for social posts, powered by your original ImageMagick scripts but with a visual editor.

## What it does

This project includes two editing pages:

- **Resize Batch** (`convert.html`)
  - Import one or many photos
  - Live canvas preview with drag-to-reposition
  - Per-image zoom and offset controls
  - Adjustable frame size, margins, background color, and frame overlay thickness
  - Export selected image or all images

- **Panorama Carousel** (`panorama.html`)
  - Import one wide landscape image
  - Split into Instagram-style carousel frames
  - Live strip preview with drag-to-reposition
  - Adjustable frame count, border size, fit mode, and placement
  - Export full strip or all sliced frames

## Also included

- Original shell scripts:
  - `convert.sh`
  - `panorama.sh`
- Theme switch (light/dark), persisted locally
- Desktop-focused editing layout

## Quick start

### Option 1: Open directly

Open `index.html` in your browser.

### Option 2: Run a tiny local server (recommended)

Some browsers behave better with a local server than `file://` paths.

From the project folder:

```powershell
python -m http.server 5500
```

Then open:

```text
http://localhost:5500/index.html
```

## Project structure

```text
index.html          Landing page
convert.html        Resize Batch page
convert.js          Resize Batch logic
panorama.html       Panorama page
panorama.js         Panorama logic
styles.css          Shared UI styles
theme.js            Theme toggle + persistence
shared.js           Shared utilities
convert.sh          Original resize shell script
panorama.sh         Original panorama shell script
```

## How to use

### Resize Batch

1. Open `Resize Batch` from the landing page.
2. Click **Browse images** and select one or more JPG/PNG files.
3. Select an item from the gallery.
4. Adjust frame and placement controls.
5. Export with **Download selected** or **Download all**.

### Panorama Carousel

1. Open `Panorama Carousel`.
2. Click **Browse panorama** and choose one JPG/PNG file.
3. Set frame count and border values.
4. Reposition with sliders or drag directly on preview.
5. Export with **Download full strip** or **Download all frames**.

## Browser notes

- Optimized for desktop usage.
- Works in Firefox, Chrome, and Edge.
- If image loading behaves oddly, use the local server method above.

## Script validation

If you want to quickly validate JavaScript syntax:

```powershell
node --check convert.js
node --check panorama.js
node --check shared.js
node --check theme.js
```

## Future ideas

- ZIP export for multi-file downloads
- Thumbnail reordering and deletion
- Keyboard shortcuts for image navigation and centering
