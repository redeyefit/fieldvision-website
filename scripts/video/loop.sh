#!/bin/bash
# Add fade-to-black for seamless loop
# Usage: ./loop.sh [fade_duration]
# Default: 0.3 second fade

INPUT="build/01_trimmed.mp4"
FADE_DURATION="${1:-0.3}"
OUTPUT="build/02_looped.mp4"

# Get video duration
DURATION=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")
FADE_START=$(echo "$DURATION - $FADE_DURATION" | bc)

echo "Adding ${FADE_DURATION}s fade at ${FADE_START}s..."
/opt/homebrew/bin/ffmpeg -y -i "$INPUT" \
  -vf "fade=t=out:st=${FADE_START}:d=${FADE_DURATION}" \
  -c:a copy \
  "$OUTPUT"

echo "Output: $OUTPUT"
