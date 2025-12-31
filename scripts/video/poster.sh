#!/bin/bash
# Extract poster frame for video element
# Usage: ./poster.sh [frame_number]
# Default: frame 0 (first frame)

INPUT="build/hero_web.mp4"
FRAME="${1:-0}"
OUTPUT="posters/hero_poster.jpg"

echo "Extracting frame ${FRAME}..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -vf "select=eq(n\,${FRAME})" \
  -vframes 1 \
  -q:v 2 \
  "$OUTPUT"

echo "Output: $OUTPUT"
