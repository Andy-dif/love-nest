"""
恋爱小窝 - Local Server
李安 ❤️ 韩舒薇
Auto-starts with Windows, serves on http://localhost:8888
"""
import http.server
import socketserver
import os
import sys
import webbrowser
import socket
import io

PORT = 8888
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Fix encoding issues on Windows (safe for pythonw silent mode)
if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'buffer') and sys.stdout.buffer:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'buffer') and sys.stderr.buffer:
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, ValueError, OSError):
        pass  # Silent mode - no console available, that's fine

class LoveHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Quieter logging
        if '/favicon.ico' not in str(args):
            print(f"  [{self.address_string()}] {args[0]}")

    def end_headers(self):
        # Add CORS and caching headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'

def safe_print(msg):
    """Print safely - ignore errors in silent mode"""
    try:
        print(msg)
    except (UnicodeEncodeError, OSError):
        pass

def main():
    os.chdir(DIRECTORY)

    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("", PORT), LoveHandler) as httpd:
            local_ip = get_local_ip()
            safe_print("=" * 50)
            safe_print("  Love Nest - LiAn & HanShuwei")
            safe_print("=" * 50)
            safe_print(f"  Local: http://localhost:{PORT}")
            if local_ip != '127.0.0.1':
                safe_print(f"  Phone: http://{local_ip}:{PORT}")
            safe_print(f"  LiAn:  http://localhost:{PORT}#li")
            safe_print(f"  Shuwei: http://localhost:{PORT}#han")
            safe_print("=" * 50)
            safe_print("  Server running. Close this window to stop.")
            safe_print("=" * 50)

            # Open browser automatically
            try:
                webbrowser.open(f'http://localhost:{PORT}')
            except Exception:
                pass

            httpd.serve_forever()
    except OSError as e:
        if e.errno == 10048:  # Port already in use
            safe_print(f"Port {PORT} already in use - server may already be running")
            safe_print(f"Visit: http://localhost:{PORT}")
            try:
                webbrowser.open(f'http://localhost:{PORT}')
            except Exception:
                pass
            try:
                input("Press Enter to exit...")
            except (EOFError, OSError):
                pass
        else:
            raise

if __name__ == '__main__':
    main()
