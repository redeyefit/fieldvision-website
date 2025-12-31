#!/bin/bash
# Export web-optimized hero video (muted, autoplay-ready)
# Usage: ./export_web.sh [quality]
# Quality: 18 (high) to 28 (low), default 23

INPUT="build/02_looped.mp4"
CRF="${1:-23}"
OUTPUT="build/hero_web.mp4"

echo "Exporting web-optimized (CRF ${CRF})..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -an \
  -movflags +faststart \
  -pix_fmt yuv420p \
  -c:v libx264 \
  -preset slow \
  -crf "$CRF" \
  -profile:v high \
  -level 4.2 \
  "$OUTPUT"

# Show file size
SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "Output: $OUTPUT ($SIZE)"
