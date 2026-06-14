#!/usr/bin/env python3
"""Tiny local proxy exposing Microsoft Edge neural TTS to the browser demo.

Browsers can't call Edge TTS directly (it needs a websocket handshake + dodges
CORS), so this forwards GET /tts?text=...&voice=... to the `edge-tts` library
and returns MP3 audio with permissive CORS headers.

Setup:
    pip install edge-tts
    python3 tools/edge_proxy.py        # listens on http://localhost:5050

Endpoints:
    GET /health                 -> "ok"
    GET /tts?text=...&voice=...  -> audio/mpeg
"""
import asyncio
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import edge_tts
except ImportError:
    sys.exit("Missing dependency. Run:  pip install edge-tts")

PORT = 5050
DEFAULT_VOICE = "ja-JP-NanamiNeural"


async def synth(text: str, voice: str) -> bytes:
    """Stream Edge TTS audio for `text` in `voice` and return the MP3 bytes."""
    communicate = edge_tts.Communicate(text, voice)
    buf = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf += chunk["data"]
    return bytes(buf)


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if parsed.path != "/tts":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        q = parse_qs(parsed.query)
        text = (q.get("text") or [""])[0].strip()
        voice = (q.get("voice") or [DEFAULT_VOICE])[0]
        if not text:
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b"missing text")
            return
        try:
            audio = asyncio.run(synth(text, voice))
        except Exception as e:  # surface the real error to the browser
            self.send_response(500)
            self._cors()
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8"))
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self._cors()
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, *args) -> None:  # quiet
        pass


if __name__ == "__main__":
    print(f"Edge TTS proxy on http://localhost:{PORT}  (Ctrl-C to stop)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
