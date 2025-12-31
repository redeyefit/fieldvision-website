#!/bin/bash
# Create 9:16 vertical cut for social
# Usage: ./vertical.sh [position]
# Position: left, center, right (default: center)

INPUT="build/hero_web.mp4"
POSITION="${1:-center}"
OUTPUT="build/hero_vertical.mp4"

case "$POSITION" in
  left)
    CROP="crop=ih*9/16:ih:0:0"
    ;;
  right)
    CROP="crop=ih*9/16:ih:iw-ih*9/16:0"
    ;;
  *)
    CROP="crop=ih*9/16:ih"
    ;;
esac

echo "Creating 9:16 vertical (${POSITION})..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -vf "$CROP" \
  -an \
  -c:v libx264 \
  -crf 23 \
  "$OUTPUT"

SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "Output: $OUTPUT ($SIZE)"
