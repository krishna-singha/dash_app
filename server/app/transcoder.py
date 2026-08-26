import re
import subprocess
import sys
import uuid
from pathlib import Path

# Paths
SERVER_DIR = Path(__file__).resolve().parent.parent
VIDEOS_DIR = SERVER_DIR / "videos"

# Standard bitrates for common resolutions
BITRATES = {
    144: "100k",
    240: "300k",
    360: "600k",
    480: "1000k",
    720: "2500k",
    1080: "4500k",
    1440: "7000k",
    2160: "14000k",
}


def get_bitrate(height: int) -> str:
    """Returns bitrate for a given height or estimates if custom."""
    if height in BITRATES:
        return BITRATES[height]
    if height <= 240:
        return "250k"
    elif height <= 480:
        return "1000k"
    elif height <= 720:
        return "2500k"
    elif height <= 1080:
        return "4500k"
    return "7000k"


def check_has_audio(input_file: Path) -> bool:
    """Checks if input video has an audio stream."""
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(input_file),
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return bool(res.stdout.strip())
    except Exception:
        return False


def generate_thumbnail(input_file: Path, thumbnail_path: Path):
    """Extracts a thumbnail image at 2s with fallback to beginning."""
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-ss", "00:00:02",
                "-i", str(input_file),
                "-frames:v", "1", "-update", "1", "-q:v", "2",
                str(thumbnail_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(input_file),
                "-frames:v", "1", "-update", "1", "-q:v", "2",
                str(thumbnail_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def transcode(input_path: str | Path, qualities: list[int]):
    """Transcodes video into multi-quality MPEG-DASH with unique ID."""
    input_file = Path(input_path).resolve()
    if not input_file.exists():
        print(f"Error: Video file not found: {input_file}")
        sys.exit(1)

    # 1. Auto-generate unique video ID
    safe_name = re.sub(r"[^a-zA-Z0-9]+", "-", input_file.stem.lower()).strip("-")
    unique_id = f"{safe_name}_{uuid.uuid4().hex[:6]}"

    # 2. Output directory
    output_dir = VIDEOS_DIR / unique_id
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.mpd"
    thumbnail_path = output_dir / "thumbnail.jpg"

    # Deduplicate and sort qualities ascending
    qualities = sorted(list(set(qualities)))
    quality_labels = [f"{q}p" for q in qualities]

    # 3. Generate thumbnail
    print("--> Extracting thumbnail...")
    generate_thumbnail(input_file, thumbnail_path)

    # 4. Check audio
    has_audio = check_has_audio(input_file)
    print(f"--> Audio detected: {has_audio}")

    # 5. Build ffmpeg command
    num_q = len(qualities)
    if num_q == 1:
        q = qualities[0]
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_file),
            "-vf", f"scale=-2:{q}",
            "-map", "0:v:0",
            "-b:v:0", get_bitrate(q),
        ]
    else:
        splits = "".join(f"[s{i}]" for i in range(num_q))
        filter_parts = [f"[0:v]split={num_q}{splits}"]
        for i, q in enumerate(qualities):
            filter_parts.append(f"[s{i}]scale=-2:{q}[v{i}]")
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_file),
            "-filter_complex", ";".join(filter_parts),
        ]
        for i, q in enumerate(qualities):
            cmd.extend(["-map", f"[v{i}]", f"-b:v:{i}", get_bitrate(q)])

    # Audio mapping
    if has_audio:
        cmd.extend(["-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-ar", "48000"])
        adaptation_sets = "id=0,streams=v id=1,streams=a"
    else:
        cmd.append("-an")
        adaptation_sets = "id=0,streams=v"

    # DASH muxer options
    cmd.extend([
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-g", "240",
        "-keyint_min", "240",
        "-sc_threshold", "0",
        "-force_key_frames", "expr:gte(t,n_forced*4)",
        "-f", "dash",
        "-dash_segment_type", "mp4",
        "-seg_duration", "4",
        "-use_template", "1",
        "-use_timeline", "1",
        "-init_seg_name", "init-$RepresentationID$.$ext$",
        "-media_seg_name", "chunk-$RepresentationID$-$Number%05d$.$ext$",
        "-adaptation_sets", adaptation_sets,
        str(manifest_path),
    ])

    print("--> Transcoding MPEG-DASH streams...")
    subprocess.run(cmd, check=True)

    print("\n========================================")
    print("Transcoding Finished!")
    print(f"Video ID:    {unique_id}")
    print(f"Qualities:   {', '.join(quality_labels)}")
    print(f"Manifest:    {manifest_path}")
    print(f"Stream URL:  http://127.0.0.1:8000/videos/{unique_id}/manifest.mpd")
    print(f"API URL:     http://127.0.0.1:8000/api/video/{unique_id}")
    print("========================================")
    return unique_id


def main():
    if len(sys.argv) < 2:
        print("Usage: python server/app/transcoder.py <video_path> [qualities...]")
        print("Example: python server/app/transcoder.py media/video2.mp4 144 360 1080 1440")
        sys.exit(1)

    video_path = sys.argv[1]

    qualities = []
    for arg in sys.argv[2:]:
        # Extract digits in case user writes '144p' or '144'
        match = re.search(r"\d+", arg)
        if match:
            qualities.append(int(match.group()))

    # Default qualities if none provided
    if not qualities:
        qualities = [144, 480, 1080]

    transcode(video_path, qualities)


if __name__ == "__main__":
    main()