#!/usr/bin/env python3
"""
Serve this folder on your Wi-Fi so an iPhone can open it.

  python3 serve.py              http://<this-mac>:8000
  python3 serve.py 8080         another port
  python3 serve.py --https      https://<this-mac>:8443 using cert.pem + key.pem (see README)
"""
import functools, http.server, os, socket, ssl, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
HTTPS = "--https" in sys.argv
ports = [a for a in sys.argv[1:] if a.isdigit()]
PORT = int(ports[0]) if ports else (8443 if HTTPS else 8000)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the Wi-Fi interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def bonjour_name():
    try:
        return subprocess.run(["scutil", "--get", "LocalHostName"], capture_output=True, text=True).stdout.strip()
    except OSError:
        return ""


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always fresh while developing
        super().end_headers()


server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=ROOT))
scheme = "http"
if HTTPS:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(os.path.join(ROOT, "cert.pem"), os.path.join(ROOT, "key.pem"))
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    scheme = "https"

name = bonjour_name()
print("\n  5-a-side Subs is running. On your iPhone (same Wi-Fi) open:\n")
print(f"    {scheme}://{lan_ip()}:{PORT}")
if name:
    print(f"    {scheme}://{name}.local:{PORT}")
print(f"\n  Test mode (20x speed): add ?speed=20 to the address.  Ctrl+C to stop.\n")
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
