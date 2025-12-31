#!/bin/bash
# Full pipeline: source → web-ready hero + poster
# Usage: ./ship.sh <source_video> [duration] [text_overlay]
#
# Examples:
#   ./ship.sh ~/Downloads/runway_output.mp4
#   ./ship.sh ~/Downloads/runway_output.mp4 14.5
#   ./ship.sh ~/Downloads/runway_output.mp4 14.5 "Get home earlier."

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SOURCE="$1"
DURATION="${2:-14.5}"
TEXT_OVERLAY="$3"

if [ -z "$SOURCE" ]; then
  echo "Usage: ./ship.sh <source_video> [duration] [text_overlay]"
  echo ""
  echo "Examples:"
  echo "  ./ship.sh ~/Downloads/runway_output.mp4"
  echo "  ./ship.sh ~/Downloads/runway_output.mp4 14.5"
  echo "  ./ship.sh ~/Downloads/runway_output.mp4 14.5 \"Get home earlier.\""
  exit 1
fi

echo "=========================================="
echo "FIELDVISION VIDEO PIPELINE"
echo "=========================================="
echo "Source: $SOURCE"
echo "Duration: ${DURATION}s"
echo "Text: ${TEXT_OVERLAY:-none}"
echo ""

# Step 1: Trim
echo "[1/5] Trimming..."
./trim.sh "$SOURCE" "$DURATION"

# Step 2: Loop fade
echo "[2/5] Adding loop fade..."
./loop.sh

# Step 3: Text overlay (optional)
if [ -n "$TEXT_OVERLAY" ]; then
  echo "[3/5] Adding text overlay..."
  ./text_overlay.sh "$TEXT_OVERLAY"
else
  echo "[3/5] Skipping text overlay"
fi

# Step 4: Web export
echo "[4/5] Exporting web-optimized..."
./export_web.sh

# Step 5: Poster frame
echo "[5/5] Extracting poster..."
./poster.sh

echo ""
echo "=========================================="
echo "DONE"
echo "=========================================="
echo ""
echo "Outputs:"
ls -lh build/hero_web.mp4 posters/hero_poster.jpg
echo ""
echo "To deploy to website:"
echo "  cp build/hero_web.mp4 ../hero.mp4"
echo "  cp posters/hero_poster.jpg ../hero_poster.jpg"
