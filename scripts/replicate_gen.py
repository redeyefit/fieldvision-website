#!/usr/bin/env python3
"""
Replicate Image/Video Generator CLI
Usage:
    python3 replicate_gen.py "your prompt"                    # Flux Schnell (fast)
    python3 replicate_gen.py "your prompt" --model flux-pro   # Flux Pro (quality)
    python3 replicate_gen.py "your prompt" --video            # Text-to-video
    python3 replicate_gen.py --animate image.png "subtle motion"  # Image-to-video
"""

import os
import sys
import argparse
import requests
import replicate

API_TOKEN = os.environ.get("REPLICATE_API_TOKEN")
if not API_TOKEN:
    print("ERROR: Set REPLICATE_API_TOKEN environment variable")
    sys.exit(1)

MODELS = {
    # Images
    "flux-schnell": "black-forest-labs/flux-schnell",
    "flux-pro": "black-forest-labs/flux-1.1-pro",
    "sdxl": "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    # Video
    "svd": "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
}


def generate_image(prompt: str, model: str = "flux-schnell", output: str = "replicate_output.png"):
    """Generate image using Replicate"""
    print(f"\n{'='*50}")
    print("REPLICATE IMAGE GENERATOR")
    print(f"{'='*50}")
    print(f"Prompt: {prompt}")
    print(f"Model: {model}")
    print(f"Output: {output}")
    print(f"{'='*50}\n")

    model_id = MODELS.get(model, model)
    print(f"[1/2] Running {model_id}...")

    try:
        if model in ["flux-schnell", "flux-pro"]:
            output_url = replicate.run(
                model_id,
                input={
                    "prompt": prompt,
                    "aspect_ratio": "16:9",
                    "output_format": "png",
                }
            )
        else:
            output_url = replicate.run(
                model_id,
                input={"prompt": prompt}
            )

        # Handle different output formats
        if isinstance(output_url, list):
            output_url = output_url[0]

        if hasattr(output_url, 'url'):
            output_url = output_url.url
        elif hasattr(output_url, 'read'):
            # It's a file-like object
            with open(output, "wb") as f:
                f.write(output_url.read())
            print(f"\n{'='*50}")
            print("DONE")
            print(f"{'='*50}")
            print(f"Output: {output}")
            return output

        print(f"\n[2/2] Downloading...")
        response = requests.get(str(output_url))
        with open(output, "wb") as f:
            f.write(response.content)

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    print(f"\n{'='*50}")
    print("DONE")
    print(f"{'='*50}")
    print(f"Output: {output}")
    print(f"Size: {os.path.getsize(output) / 1024:.1f} KB")

    return output


def generate_video(prompt: str = None, image_path: str = None, output: str = "replicate_output.mp4"):
    """Generate video from image using Stable Video Diffusion"""
    if not image_path:
        print("ERROR: Image-to-video requires --animate <image>")
        sys.exit(1)

    print(f"\n{'='*50}")
    print("REPLICATE VIDEO GENERATOR (SVD)")
    print(f"{'='*50}")
    print(f"Image: {image_path}")
    if prompt:
        print(f"Motion: {prompt}")
    print(f"Output: {output}")
    print(f"{'='*50}\n")

    print("[1/2] Running stable-video-diffusion...")

    try:
        with open(image_path, "rb") as f:
            output_url = replicate.run(
                MODELS["svd"],
                input={
                    "input_image": f,
                    "motion_bucket_id": 127,  # Higher = more motion
                    "fps": 7,
                    "num_frames": 25,
                }
            )

        if isinstance(output_url, list):
            output_url = output_url[0]

        print(f"\n[2/2] Downloading...")
        response = requests.get(str(output_url))
        with open(output, "wb") as f:
            f.write(response.content)

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    print(f"\n{'='*50}")
    print("DONE")
    print(f"{'='*50}")
    print(f"Output: {output}")
    print(f"Size: {os.path.getsize(output) / 1024 / 1024:.1f} MB")

    return output


def main():
    parser = argparse.ArgumentParser(description="Replicate Image/Video Generator")
    parser.add_argument("prompt", type=str, nargs="?", default=None, help="Text prompt")
    parser.add_argument("--model", type=str, default="flux-schnell",
                       choices=["flux-schnell", "flux-pro", "sdxl"],
                       help="Image model (default: flux-schnell)")
    parser.add_argument("--animate", type=str, default=None, help="Image to animate (enables video mode)")
    parser.add_argument("--output", type=str, default=None, help="Output filename")

    args = parser.parse_args()

    if args.animate:
        # Video mode
        output = args.output or "replicate_output.mp4"
        generate_video(args.prompt, args.animate, output)
    else:
        # Image mode
        if not args.prompt:
            parser.error("prompt is required for image generation")
        output = args.output or "replicate_output.png"
        generate_image(args.prompt, args.model, output)


if __name__ == "__main__":
    main()
