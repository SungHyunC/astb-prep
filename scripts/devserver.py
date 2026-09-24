#!/usr/bin/env python3
"""로컬 미리보기용 정적 서버 — 캐시를 끄고(no-store) 프로젝트 루트를 서빙한다.
사용: python3 scripts/devserver.py [포트=8765]
(서비스워커가 옛 파일을 잡고 있으면 앱 ⚙️ → 강제 업데이트)"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
