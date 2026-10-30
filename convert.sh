#!/bin/bash

# Requires imagemagick.
# This script only resizes images in the folder, it ignores video files
# Usage: ./convert.sh [path-to-image-folder]
#   If no path is given, you'll be prompted for one.
#   Resized images are saved to ~/Downloads.

target_width=1080
target_height=1350         # Instagram portrait, 4:5
top_bottom_border=20       # white padding always added on top and bottom
max_side_border=20         # minimum guaranteed white margin on left/right for square-ish or wide photos
bg_color="white"

inner_height=$((target_height - 2 * top_bottom_border))
content_max_width=$((target_width - 2 * max_side_border))

# Use the first argument if given, otherwise prompt for it
if [ -n "$1" ]; then
	image_dir="$1"
else
	read -e -p "Enter path to image folder: " image_dir
fi

# Expand a leading ~ if the user typed one
image_dir="${image_dir/#\~/$HOME}"

if [ -z "$image_dir" ]; then
	echo "Please provide image directory as first argument."
	exit 1
fi

if [ ! -d "$image_dir" ]; then
	echo "Not a valid directory"
	exit 1
fi

# Strip any trailing slash so basename works consistently
image_dir="${image_dir%/}"
folder_name=$(basename "$image_dir")
output_dir="$HOME/Downloads/${folder_name}-output"

# If the output folder already exists, add a numeric suffix instead of failing
if [ -d "$output_dir" ]; then
	i=2
	while [ -d "$HOME/Downloads/${folder_name}-output-$i" ]; do
		i=$((i + 1))
	done
	output_dir="$HOME/Downloads/${folder_name}-output-$i"
fi

mkdir -p "$output_dir"
echo "Saving resized images to: $output_dir"

for image in "$image_dir"/*; do
	[ -f "$image" ] || continue
	echo "Checking $image"
	filename=$(basename "$image")
	extension="${filename##*.}"
	extension_to_lower=$(echo "$extension" | tr '[:upper:]' '[:lower:]')

	if [[ "$extension_to_lower" == "jpg" || "$extension_to_lower" == "jpeg" || "$extension_to_lower" == "png" ]]; then
		echo "converting $filename"
		convert -background "$bg_color" -gravity center \
			-resize "${content_max_width}x${inner_height}" \
			-extent "${target_width}x${inner_height}" \
			-bordercolor "$bg_color" -border 0x"$top_bottom_border" \
			"$image" "$output_dir"/"$filename"
	fi
done

echo "Done."