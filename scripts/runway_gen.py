#!/usr/bin/env python3
"""
Runway Gen-3 Video Generator CLI
Usage:
    python3 runway_gen.py "your prompt here"
    python3 runway_gen.py "your prompt" --duration 10
    python3 runway_gen.py --image input.png "animate this scene"
"""

import os
import sys
import time
import argparse
import requests
from runwayml import RunwayML

API_KEY = os.environ.get("RUNWAY_API_KEY")
if not API_KEY:
    print("ERROR: Set RUNWAY_API_KEY environment variable")
    sys.exit(1)

def generate_video(prompt: str, duration: int = 5, image_path: str = None, output: str = "runway_output.mp4"):
    """Generate video using Runway Gen-3"""
    client = RunwayML(api_key=API_KEY)

    print(f"\n{'='*50}")
    print("RUNWAY GEN-3 VIDEO GENERATOR")
    print(f"{'='*50}")
    print(f"Prompt: {prompt}")
    print(f"Duration: {duration}s")
    if image_path:
        print(f"Image: {image_path}")
    print(f"Output: {output}")
    print(f"{'='*50}\n")

    # Start generation
    print("[1/3] Starting generation...")

    try:
        if image_path:
            # Image-to-video (gen4_turbo or gen3a_turbo)
            task = client.image_to_video.create(
                model="gen4_turbo",
                prompt_image=open(image_path, "rb"),
                prompt_text=prompt,
                duration=duration,
                ratio="1280:720",
            )
        else:
            # Text-to-video (veo3.1_fast or veo3.1 or veo3)
            task = client.text_to_video.create(
                model="veo3.1_fast",
                prompt_text=prompt,
                duration=duration,
                ratio="1280:720",
            )

        task_id = task.id
        print(f"  Task ID: {task_id}")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    # Poll for completion
    print("\n[2/3] Processing...")
    while True:
        task = client.tasks.retrieve(task_id)
        status = task.status

        if status == "SUCCEEDED":
            print(f"  Status: {status}")
            break
        elif status == "FAILED":
            print(f"  Status: FAILED")
            print(f"  Error: {task.failure}")
            sys.exit(1)
        else:
            print(f"  Status: {status}...", end="\r")
            time.sleep(5)

    # Download result
    print("\n[3/3] Downloading video...")
    video_url = task.output[0]

    response = requests.get(video_url)
    with open(output, "wb") as f:
        f.write(response.content)

    print(f"\n{'='*50}")
    print("DONE")
    print(f"{'='*50}")
    print(f"Output: {output}")
    print(f"Size: {os.path.getsize(output) / 1024 / 1024:.1f} MB")

    return output


def main():
    parser = argparse.ArgumentParser(description="Runway Gen-3 Video Generator")
    parser.add_argument("prompt", type=str, help="Text prompt for video generation")
    parser.add_argument("--duration", type=int, default=6, choices=[4, 6, 8], help="Video duration (4, 6, or 8 seconds)")
    parser.add_argument("--image", type=str, default=None, help="Input image for image-to-video")
    parser.add_argument("--output", type=str, default="runway_output.mp4", help="Output filename")

    args = parser.parse_args()
    generate_video(args.prompt, args.duration, args.image, args.output)


if __name__ == "__main__":
    main()
