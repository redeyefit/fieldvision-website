#!/bin/bash
# Add text overlay (end card / CTA)
# Usage: ./text_overlay.sh "Your Text Here" [start_time] [duration]

INPUT="build/02_looped.mp4"
TEXT="${1:-Get home earlier.}"
START="${2:-12}"
DURATION="${3:-2.5}"
OUTPUT="build/02_looped_text.mp4"

# Font settings
FONTSIZE=72
FONTCOLOR="white"
BORDERW=3

echo "Adding text overlay: '$TEXT' at ${START}s for ${DURATION}s..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -vf "drawtext=text='${TEXT}':fontsize=${FONTSIZE}:fontcolor=${FONTCOLOR}:borderw=${BORDERW}:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${START},${START}+${DURATION})'" \
  -c:a copy \
  "$OUTPUT"

# Use this as input for export_web.sh
mv "$OUTPUT" "build/02_looped.mp4"
echo "Text overlay applied"
