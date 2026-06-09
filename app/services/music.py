from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import HTTPException

from app.models import MusicLibraryResponse, MusicTrackResponse


BASE_DIR = Path(__file__).resolve().parent.parent.parent
MUSIC_ROOT = BASE_DIR / "app" / "static" / "music"
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}
SCAN_EXTENSIONS = SUPPORTED_AUDIO_EXTENSIONS | {".ncm"}
TRACK_CATALOG = [
    ("one-last-kiss", "One Last Kiss", "Utada Hikaru"),
    ("beautiful-world", "Beautiful World", "Utada Hikaru"),
    ("cruel-angels-thesis", "残酷な天使のテーゼ", "Yoko Takahashi"),
]


def _make_track_id(path: Path) -> str:
    return hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:16]


def _find_track_file(title: str, artist: str) -> Path | None:
    if not MUSIC_ROOT.exists():
        return None

    candidates = []
    for path in MUSIC_ROOT.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in SCAN_EXTENSIONS:
            continue
        stem = path.stem.lower()
        if title.lower() in stem or artist.lower() in stem:
            candidates.append(path)

    def rank(item: Path) -> tuple[int, int, str]:
        stem = item.stem.lower()
        exact_title = 0 if title.lower() in stem else 1
        preferred_ext = 0 if item.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS else 1
        return (exact_title, preferred_ext, stem)

    preferred = sorted(candidates, key=rank)
    return preferred[0] if preferred else None


def get_music_library() -> MusicLibraryResponse:
    tracks: list[MusicTrackResponse] = []

    for slug, title, artist in TRACK_CATALOG:
        file_path = _find_track_file(title, artist)
        if not file_path:
            tracks.append(
                MusicTrackResponse(
                    id=f"missing-{slug}",
                    title=title,
                    artist=artist,
                    filename="not found",
                    available=False,
                    reason="Track not found in app/static/music.",
                )
            )
            continue

        available = file_path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
        reason = None
        if not available:
            reason = f"{file_path.suffix.lower()} is not browser-playable. Convert it to mp3, m4a, flac, wav, or ogg."

        tracks.append(
            MusicTrackResponse(
                id=_make_track_id(file_path),
                title=title,
                artist=artist,
                filename=file_path.name,
                available=available,
                reason=reason,
            )
        )

    return MusicLibraryResponse(root=str(MUSIC_ROOT), tracks=tracks)


def resolve_track_path(track_id: str) -> Path:
    library = get_music_library()
    for track in library.tracks:
        file_path = _find_track_file(track.title, track.artist)
        if file_path and _make_track_id(file_path) == track_id:
            if file_path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
                raise HTTPException(status_code=415, detail="Track exists but its format is not browser-playable.")
            return file_path
    raise HTTPException(status_code=404, detail="Track not found.")
