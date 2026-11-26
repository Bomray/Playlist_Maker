"""Comparaison : ytmusicapi (Python, non officiel) sur la même playlist, sans auth.
Usage : .venv/bin/python youtube-music.py <lien>"""
import json
import sys
from urllib.parse import parse_qs, urlparse

from ytmusicapi import YTMusic

list_id = parse_qs(urlparse(sys.argv[1]).query)["list"][0]
pl = YTMusic().get_playlist(list_id, limit=None)
tracks = [
    {
        "title": t["title"],
        "artists": [a["name"] for a in t.get("artists") or []],
        "album": (t.get("album") or {}).get("name"),
        "durationMs": (t.get("duration_seconds") or 0) * 1000 or None,
        "isrc": None,
        "platformId": t.get("videoId"),
        "isAvailable": t.get("isAvailable"),
    }
    for t in pl["tracks"]
]
print(json.dumps({"platform": "youtube-music (ytmusicapi)", "name": pl.get("title"), "tracks": tracks}, ensure_ascii=False, indent=2))
