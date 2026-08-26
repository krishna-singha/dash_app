from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="DASH Streaming API")

VIDEOS_DIR = Path(__file__).resolve().parent.parent / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static videos directory
app.mount("/videos", StaticFiles(directory=str(VIDEOS_DIR)), name="videos")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/videos")
def get_videos():
    """Returns all available video IDs."""
    if not VIDEOS_DIR.exists():
        return []
    return [
        folder.name
        for folder in sorted(VIDEOS_DIR.iterdir())
        if folder.is_dir() and (folder / "manifest.mpd").exists()
    ]


@app.get("/api/video/{video_id}")
def get_video(video_id: str, request: Request):
    """Returns video manifest details."""
    manifest_file = VIDEOS_DIR / video_id / "manifest.mpd"
    if not manifest_file.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    base_url = str(request.base_url).rstrip("/")
    return {
        "id": video_id,
        "title": video_id.replace("_", " ").replace("-", " ").title(),
        "manifestUrl": f"{base_url}/videos/{video_id}/manifest.mpd",
        "thumbnailUrl": f"{base_url}/videos/{video_id}/thumbnail.jpg",
    }