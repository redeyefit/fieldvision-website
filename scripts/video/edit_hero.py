#!/usr/bin/env python3
"""
FieldVision Hero Video Editor
CLI-based video assembly with crossfades, end cards, and polish.

Usage:
    python3 edit_hero.py                    # Full assembly with defaults
    python3 edit_hero.py --no-crossfades    # Hard cuts only
    python3 edit_hero.py --end-card "Your tagline here"
    python3 edit_hero.py --duration 15      # Trim to 15 seconds
"""

import os
import sys
from pathlib import Path

# MoviePy imports
from moviepy import (
    VideoFileClip,
    TextClip,
    ColorClip,
    CompositeVideoClip,
    concatenate_videoclips,
)

# Configuration
SRC_DIR = Path(__file__).parent / "src"
BUILD_DIR = Path(__file__).parent / "build"
OUTPUT_FILE = BUILD_DIR / "hero_final.mp4"

# Clip sequence
CLIPS = [
    "clip1_desk.mp4",
    "clip2_jobsite.mp4",
    "clip3_phone_jobsite.mp4",
    "clip4_truck.mp4",
    "clip5_home.mp4",
]

# Video settings
TARGET_SIZE = (1280, 720)
FPS = 24
CROSSFADE_DURATION = 0.5  # seconds


def load_and_normalize(clip_path: Path) -> VideoFileClip:
    """Load a clip and normalize to 1280x720 @ 24fps."""
    clip = VideoFileClip(str(clip_path))

    # Get dimensions
    w, h = clip.size
    target_w, target_h = TARGET_SIZE

    # If vertical (portrait), crop to 16:9 from center
    if h > w:
        # Calculate crop dimensions
        new_h = int(w * 9 / 16)
        y_center = h // 2
        y1 = y_center - new_h // 2
        clip = clip.cropped(y1=y1, y2=y1 + new_h)

    # Resize to target
    clip = clip.resized(TARGET_SIZE)

    return clip


def create_end_card(text: str, duration: float = 3.0) -> VideoFileClip:
    """Create a text-on-black end card."""
    # Black background
    bg = ColorClip(size=TARGET_SIZE, color=(0, 0, 0), duration=duration)

    # Text
    txt = TextClip(
        text=text,
        font_size=60,
        color="white",
        font="Helvetica-Bold",
        size=TARGET_SIZE,
        method="caption",
    )
    txt = txt.with_duration(duration)
    txt = txt.with_position("center")

    return CompositeVideoClip([bg, txt])


def crossfade_clips(clips: list, fade_duration: float = 0.5) -> VideoFileClip:
    """Concatenate clips with crossfade transitions."""
    if len(clips) == 0:
        raise ValueError("No clips provided")
    if len(clips) == 1:
        return clips[0]

    # Use MoviePy's built-in crossfade
    return concatenate_videoclips(clips, method="compose", padding=-fade_duration)


def hard_cut_clips(clips: list) -> VideoFileClip:
    """Concatenate clips with hard cuts (no transitions)."""
    return concatenate_videoclips(clips, method="compose")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="FieldVision Hero Video Editor")
    parser.add_argument("--no-crossfades", action="store_true", help="Use hard cuts instead of crossfades")
    parser.add_argument("--end-card", type=str, default=None, help="End card text (omit to skip)")
    parser.add_argument("--duration", type=float, default=None, help="Trim final video to this duration")
    parser.add_argument("--output", type=str, default=None, help="Output filename")
    parser.add_argument("--list", action="store_true", help="List available clips and exit")

    args = parser.parse_args()

    # List mode
    if args.list:
        print("\n=== Available Clips ===")
        for clip_name in CLIPS:
            clip_path = SRC_DIR / clip_name
            if clip_path.exists():
                clip = VideoFileClip(str(clip_path))
                print(f"  {clip_name}: {clip.size[0]}x{clip.size[1]}, {clip.duration:.1f}s")
                clip.close()
            else:
                print(f"  {clip_name}: MISSING")
        return

    # Ensure output directory exists
    BUILD_DIR.mkdir(exist_ok=True)

    print("\n" + "=" * 50)
    print("FIELDVISION HERO VIDEO EDITOR")
    print("=" * 50)

    # Load clips
    print("\n[1/4] Loading and normalizing clips...")
    loaded_clips = []
    for clip_name in CLIPS:
        clip_path = SRC_DIR / clip_name
        if not clip_path.exists():
            print(f"  WARNING: {clip_name} not found, skipping")
            continue

        clip = load_and_normalize(clip_path)
        print(f"  ✓ {clip_name}: {clip.duration:.1f}s")
        loaded_clips.append(clip)

    if not loaded_clips:
        print("ERROR: No clips found!")
        sys.exit(1)

    # Assemble
    print("\n[2/4] Assembling sequence...")
    if args.no_crossfades:
        print("  Mode: Hard cuts")
        final = hard_cut_clips(loaded_clips)
    else:
        print(f"  Mode: Crossfades ({CROSSFADE_DURATION}s)")
        final = crossfade_clips(loaded_clips, CROSSFADE_DURATION)

    print(f"  Total duration: {final.duration:.1f}s")

    # End card
    if args.end_card:
        print(f"\n[3/4] Adding end card: \"{args.end_card}\"")
        end_card = create_end_card(args.end_card)
        final = concatenate_videoclips([final, end_card], method="compose")
    else:
        print("\n[3/4] No end card (use --end-card to add)")

    # Trim if requested
    if args.duration and final.duration > args.duration:
        print(f"\n[4/4] Trimming to {args.duration}s...")
        final = final.subclipped(0, args.duration)
    else:
        print(f"\n[4/4] Final duration: {final.duration:.1f}s")

    # Export
    output_path = Path(args.output) if args.output else OUTPUT_FILE
    print(f"\nExporting to: {output_path}")
    print("  Codec: H.264, CRF 23, faststart")

    final.write_videofile(
        str(output_path),
        fps=FPS,
        codec="libx264",
        audio=False,
        preset="slow",
        ffmpeg_params=["-crf", "23", "-movflags", "+faststart", "-pix_fmt", "yuv420p"],
        logger="bar",
    )

    # Cleanup
    for clip in loaded_clips:
        clip.close()
    final.close()

    print("\n" + "=" * 50)
    print("DONE")
    print("=" * 50)
    print(f"\nOutput: {output_path}")
    print(f"Size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
