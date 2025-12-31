# FieldVision Video Pipeline

CLI-based video post-production for web hero and social assets.

## Quick Start

```bash
cd website/scripts/video

# Full pipeline - one command
./ship.sh ~/Downloads/runway_output.mp4

# With text overlay
./ship.sh ~/Downloads/runway_output.mp4 14.5 "Get home earlier."
```

## Directory Structure

```
scripts/video/
├── src/           # Place source videos here
├── build/         # Intermediate + final outputs
├── posters/       # Extracted poster frames
├── trim.sh        # Trim to exact length
├── loop.sh        # Fade-to-black for seamless loop
├── text_overlay.sh # Add CTA text
├── export_web.sh  # Web-optimized output
├── poster.sh      # Extract poster frame
├── vertical.sh    # 9:16 social cut
└── ship.sh        # Run full pipeline
```

## Individual Scripts

### trim.sh
```bash
./trim.sh <input> [duration]
./trim.sh ~/Downloads/video.mp4 14.5
```

### loop.sh
```bash
./loop.sh [fade_duration]
./loop.sh 0.3  # 0.3s fade to black
```

### text_overlay.sh
```bash
./text_overlay.sh "Your Text" [start_time] [duration]
./text_overlay.sh "Get home earlier." 12 2.5
```

### export_web.sh
```bash
./export_web.sh [crf_quality]
./export_web.sh 23  # 18=high quality, 28=smaller file
```

### poster.sh
```bash
./poster.sh [frame_number]
./poster.sh 0   # First frame
./poster.sh 30  # Frame 30
```

### vertical.sh
```bash
./vertical.sh [position]
./vertical.sh left    # Crop from left
./vertical.sh center  # Crop from center
./vertical.sh right   # Crop from right
```

## Outputs

After running `ship.sh`:

| File | Purpose |
|------|---------|
| `build/hero_web.mp4` | Web hero (muted, optimized) |
| `posters/hero_poster.jpg` | Poster frame for `<video>` |
| `build/hero_vertical.mp4` | 9:16 social version |

## Deploy to Website

```bash
cp build/hero_web.mp4 ../../hero.mp4
cp posters/hero_poster.jpg ../../hero_poster.jpg
```

Then update `index.html`:
```html
<video autoplay muted loop playsinline poster="hero_poster.jpg">
  <source src="hero.mp4" type="video/mp4">
</video>
```

## Requirements

- ffmpeg (`brew install ffmpeg`)
- macOS (uses /opt/homebrew/bin/ffmpeg path)
