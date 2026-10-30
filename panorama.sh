#!/bin/bash

# Requires imagemagick.
# Splits one wide landscape image into N Instagram carousel frames
# (each 1080x1350, 4:5) so that swiping through them reveals one
# continuous panorama. A white border is applied only around the
# OUTSIDE of the whole stitched panorama — never between frames —
# so the seams stay seamless when swiping.
#
# Usage: ./carousel.sh [path-to-image] [number-of-frames]
#   Any missing argument will be prompted for.
#   Output is saved to ~/Downloads.

frame_width=1080
frame_height=1350   # Instagram portrait, 4:5
border=20           # white margin around the outside of the whole panorama only
bg_color="white"

# --- Get the source image ---
if [ -n "$1" ]; then
	image_path="$1"
else
	read -e -p "Enter path to the landscape image: " image_path
fi
image_path="${image_path/#\~/$HOME}"

if [ -z "$image_path" ] || [ ! -f "$image_path" ]; then
	echo "Not a valid image file."
	exit 1
fi

filename=$(basename "$image_path")
extension="${filename##*.}"
extension_to_lower=$(echo "$extension" | tr '[:upper:]' '[:lower:]')
name_noext="${filename%.*}"

if [[ "$extension_to_lower" != "jpg" && "$extension_to_lower" != "jpeg" && "$extension_to_lower" != "png" ]]; then
	echo "Unsupported file type: .$extension"
	exit 1
fi

# --- Get the number of frames ---
if [ -n "$2" ]; then
	num_frames="$2"
else
	read -e -p "How many frames do you want to split it into? " num_frames
fi

if ! [[ "$num_frames" =~ ^[0-9]+$ ]] || [ "$num_frames" -lt 2 ]; then
	echo "Please enter a whole number of 2 or more."
	exit 1
fi

# --- Do the math ---
total_width=$((frame_width * num_frames))
total_height=$frame_height
content_width=$((total_width - 2 * border))
content_height=$((total_height - 2 * border))

echo "Panorama canvas: ${total_width}x${total_height} (border: ${border}px)"
echo "Splitting into $num_frames frame(s) of ${frame_width}x${frame_height} each"

# --- Set up output folder ---
output_dir="$HOME/Downloads/${name_noext}-carousel"
if [ -d "$output_dir" ]; then
	i=2
	while [ -d "$HOME/Downloads/${name_noext}-carousel-$i" ]; do
		i=$((i + 1))
	done
	output_dir="$HOME/Downloads/${name_noext}-carousel-$i"
fi
mkdir -p "$output_dir"

# --- Build the full stitched panorama with the outer border ---
panorama="$output_dir/.panorama-tmp.${extension_to_lower}"
convert -background "$bg_color" -gravity center \
	-resize "${content_width}x${content_height}^" \
	-extent "${content_width}x${content_height}" \
	-bordercolor "$bg_color" -border "${border}x${border}" \
	"$image_path" "$panorama"

# --- Slice it into carousel frames, left to right ---
for ((i = 0; i < num_frames; i++)); do
	x_offset=$((i * frame_width))
	frame_num=$((i + 1))
	out_file="$output_dir/${name_noext}-${frame_num}.${extension_to_lower}"
	convert "$panorama" -crop "${frame_width}x${frame_height}+${x_offset}+0" +repage "$out_file"
	echo "Saved frame $frame_num: $out_file"
done

rm -f "$panorama"
echo "Done. Upload frames ${name_noext}-1 through ${name_noext}-${num_frames} to Instagram in that order."