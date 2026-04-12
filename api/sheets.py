"""
/api/sheets  — 구글시트에서 티커 목록 로드
환경변수: GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME
"""
from http.server import BaseHTTPRequestHandler
import json
import os
from urllib.request import urlopen
from urllib.parse import quote
import csv
import io


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            sheet_id   = os.environ.get("GOOGLE_SHEET_ID", "")
            sheet_name = os.environ.get("GOOGLE_SHEET_NAME", "Sheet1")

            if not sheet_id:
                return self._err(400, "GOOGLE_SHEET_ID 환경변수가 설정되지 않았습니다.")

            encoded = quote(sheet_name)
            url = (
                f"https://docs.google.com/spreadsheets/d/{sheet_id}"
                f"/gviz/tq?tqx=out:csv&sheet={encoded}"
            )

            with urlopen(url, timeout=10) as resp:
                content = resp.read().decode("utf-8")

            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)

            if not rows or ("티커" not in rows[0] or "기업명" not in rows[0]):
                return self._err(400, f"'티커', '기업명' 컬럼이 없습니다. 실제 컬럼: {list(rows[0].keys()) if rows else []}")

            tickers = [
                {"ticker": r["티커"].strip(), "name": r["기업명"].strip()}
                for r in rows if r.get("티커", "").strip()
            ]

            self._ok({"tickers": tickers})

        except Exception as e:
            self._err(500, str(e))

    def _ok(self, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self._hdr(len(body))
        self.wfile.write(body)

    def _err(self, code, msg):
        body = json.dumps({"error": msg}, ensure_ascii=False).encode()
        self.send_response(code)
        self._hdr(len(body))
        self.wfile.write(body)

    def _hdr(self, n):
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(n))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def log_message(self, *_): pass
