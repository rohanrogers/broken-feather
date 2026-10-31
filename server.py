"""Local-only preview: never cache app code while it is being edited."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith("/assets/"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


if __name__ == "__main__":
    root = str(Path(__file__).resolve().parent / "dist")
    server = ThreadingHTTPServer(("127.0.0.1", 5180), partial(PreviewHandler, directory=root))
    print("Chicken Shot: http://127.0.0.1:5180 (fresh app code, cached model assets)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
