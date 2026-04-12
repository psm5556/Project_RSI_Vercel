"""
/api/trend  — Trend Vision (주봉): Supertrend + MACD 신호
Query params: ticker, lookback (default 5y)
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

import yfinance as yf
import pandas as pd
import numpy as np


def _supertrend(high, low, close, period=20, multiplier=2.5):
    n = len(close)
    h = high.values.astype(float)
    l = low.values.astype(float)
    c = close.values.astype(float)

    prev_c = np.roll(c, 1); prev_c[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))

    alpha = 1.0 / period
    atr = np.zeros(n); atr[0] = tr[0]
    for i in range(1, n):
        atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1]

    hl2 = (h + l) / 2
    raw_upper = hl2 + multiplier * atr
    raw_lower = hl2 - multiplier * atr
    upper, lower = raw_upper.copy(), raw_lower.copy()
    supertrend = np.zeros(n)
    is_up = np.ones(n, dtype=bool)

    supertrend[0] = lower[0]
    for i in range(1, n):
        lower[i] = raw_lower[i] if (raw_lower[i] > lower[i-1] or c[i-1] < lower[i-1]) else lower[i-1]
        upper[i] = raw_upper[i] if (raw_upper[i] < upper[i-1] or c[i-1] > upper[i-1]) else upper[i-1]
        is_up[i] = (c[i] >= lower[i]) if is_up[i-1] else (c[i] > upper[i])
        supertrend[i] = lower[i] if is_up[i] else upper[i]

    return (
        pd.Series(supertrend, index=close.index),
        pd.Series(is_up, index=close.index),
    )


def _filter_gap(mask: pd.Series, gap=4) -> pd.Series:
    result = mask.copy()
    last = -gap
    for i, (idx, v) in enumerate(mask.items()):
        if v:
            if i - last < gap: result[idx] = False
            else: last = i
    return result


def s2list(s): return [None if pd.isna(v) else float(v) for v in s]
def b2list(s): return [bool(v) for v in s]
def idx2str(index):
    try: return [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in index]
    except: return [str(d) for d in index]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            params   = parse_qs(urlparse(self.path).query)
            ticker   = params.get("ticker",  ["^GSPC"])[0].strip()
            lookback = params.get("lookback", ["5y"])[0]

            hist = yf.Ticker(ticker).history(period=lookback, interval="1wk")
            if hist.empty:
                return self._err(404, f"데이터 없음: {ticker}")

            close = hist["Close"].dropna()
            high  = hist["High"]
            low   = hist["Low"]
            dates = hist.index

            # Supertrend
            st_line, is_up = _supertrend(high, low, close, period=20, multiplier=2.5)

            # MACD
            ema12 = close.ewm(span=12, adjust=False).mean()
            ema26 = close.ewm(span=26, adjust=False).mean()
            macd  = ema12 - ema26
            sig   = macd.ewm(span=9, adjust=False).mean()
            hist_m = macd - sig

            # RSI (Wilder 14)
            delta = close.diff()
            ag = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
            al = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
            rsi = 100 - 100 / (1 + ag / al.replace(0, np.nan))

            # MA
            ma20 = close.rolling(20).mean()
            ma60 = close.rolling(60).mean()

            # 신호 감지
            up_raw     = (hist_m > 0) & (hist_m.shift(1) <= 0) & is_up
            down_raw   = (hist_m < 0) & (hist_m.shift(1) >= 0) & (~is_up)
            bottom_raw = (~is_up.shift(1).fillna(True)) & is_up & (rsi < 40)

            up_sig     = _filter_gap(up_raw, 4)
            down_sig   = _filter_gap(down_raw, 4)
            bottom_sig = _filter_gap(bottom_raw, 4)

            def sig_points(mask, price_series, side):
                pts = []
                for i, (idx, v) in enumerate(mask.items()):
                    if v:
                        pts.append({
                            "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                            "price": float(price_series.iloc[i]),
                            "side": side,
                        })
                return pts

            signals = (
                sig_points(up_sig,     low,   "UP")
                + sig_points(down_sig, high,  "DOWN")
                + sig_points(bottom_sig, low, "BOTTOM")
            )

            # 현재 상태
            cur_is_up = bool(is_up.iloc[-1])
            cur_rsi   = float(rsi.dropna().iloc[-1])
            cur_macd  = float(macd.iloc[-1])
            cur_hist  = float(hist_m.iloc[-1])
            vs_ma20   = float((close.iloc[-1] / ma20.iloc[-1] - 1) * 100) if not pd.isna(ma20.iloc[-1]) else None
            vs_ma60   = float((close.iloc[-1] / ma60.iloc[-1] - 1) * 100) if not pd.isna(ma60.iloc[-1]) else None

            result = {
                "dates":       idx2str(dates),
                "open":        s2list(hist["Open"]),
                "high":        s2list(high),
                "low":         s2list(low),
                "close":       s2list(close),
                "supertrend":  s2list(st_line),
                "is_up":       b2list(is_up),
                "macd":        s2list(macd),
                "macd_signal": s2list(sig),
                "macd_hist":   s2list(hist_m),
                "rsi":         s2list(rsi),
                "ma20":        s2list(ma20),
                "ma60":        s2list(ma60),
                "signals":     signals,
                "summary": {
                    "is_up":   cur_is_up,
                    "rsi":     round(cur_rsi, 1),
                    "macd":    round(cur_macd, 4),
                    "macd_hist": round(cur_hist, 4),
                    "vs_ma20": round(vs_ma20, 2) if vs_ma20 is not None else None,
                    "vs_ma60": round(vs_ma60, 2) if vs_ma60 is not None else None,
                },
            }

            self._ok(result)

        except Exception as e:
            self._err(500, str(e))

    def _ok(self, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(200)
        self._hdr(len(body))
        self.wfile.write(body)

    def _err(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self._hdr(len(body))
        self.wfile.write(body)

    def _hdr(self, n):
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(n))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def log_message(self, *_): pass
