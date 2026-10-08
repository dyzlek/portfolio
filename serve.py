"""Serveur local pour tester le portfolio : python serve.py  →  http://localhost:5173
(Windows associe parfois .js à text/plain, ce qui bloque les modules : on force les bons types.)"""
import http.server
import mimetypes
import sys

for ext, mime in {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
                  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4'}.items():
    mimetypes.add_type(mime, ext)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # toujours la dernière version en dev
        super().end_headers()


handler = Handler
handler.extensions_map.update({k: mimetypes.types_map[k] for k in ('.js', '.mjs', '.css', '.webp', '.svg', '.mp4')})
print(f'Portfolio sur http://localhost:{port}')
http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
