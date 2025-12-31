#!/bin/bash
# Trim video to exact hero length
# Usage: ./trim.sh [input] [duration]
# Default: 14.5 seconds

INPUT="${1:-src/source.mp4}"
DURATION="${2:-14.5}"
OUTPUT="build/01_trimmed.mp4"

echo "Trimming to ${DURATION}s..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -t "$DURATION" \
  -map 0:v:0 -map 0:a? \
  -c copy \
  "$OUTPUT"

echo "Output: $OUTPUT"
