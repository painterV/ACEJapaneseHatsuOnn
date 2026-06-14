#!/usr/bin/env python3
"""Minimal static file server rooted at this script's directory.

Avoids `python -m http.server`'s argparse, which evaluates os.getcwd() at import
time and fails when the launching process has an inaccessible working directory.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

os.chdir(ROOT)
handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"serving {ROOT} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
