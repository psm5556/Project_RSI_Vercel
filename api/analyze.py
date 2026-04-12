"""
/api/analyze  — RSI 계산 + 타겟 가격 + 차트 데이터
Query params: ticker, period, interval, lookback
"""
from http.server import BaseHTTPRequestHandler
import json
import re
from urllib.parse import urlparse, parse_qs

import yfinance as yf
import pandas as pd
import numpy as np


# ── RSI 계산 ─────────────────────────────────────────────────────────────────

def _gains_losses(prices: pd.Series):
    delta = prices.diff()
    return delta.clip(lower=0), -delta.clip(upper=0)


def calc_rsi_wilder(prices, period):
    gain, loss = _gains_losses(prices)
    ag = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    al = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    return 100 - 100 / (1 + ag / al), ag, al


def calc_rsi_sma(prices, period):
    gain, loss = _gains_losses(prices)
    ag = gain.rolling(window=period).mean()
    al = loss.rolling(window=period).mean()
    og = gain.shift(period - 1)
    ol = loss.shift(period - 1)
    return 100 - 100 / (1 + ag / al), ag, al, og, ol


def calc_rsi_ema(prices, period):
    gain, loss = _gains_losses(prices)
    ag = gain.ewm(span=period, min_periods=period, adjust=False).mean()
    al = loss.ewm(span=period, min_periods=period, adjust=False).mean()
    return 100 - 100 / (1 + ag / al), ag, al


# ── 타겟 가격 역산 ─────────────────────────────────────────────────────────────

def _cur_rsi(ag, al):
    if al == 0: return 100.0
    if ag == 0: return 0.0
    return 100 - 100 / (1 + ag / al)


def target_wilder(price, ag, al, t_rsi, n):
    if t_rsi <= 0 or t_rsi >= 100: return None
    rs = t_rsi / (100 - t_rsi)
    if t_rsi >= _cur_rsi(ag, al):
        return price + (n - 1) * (rs * al - ag)
    return None if rs == 0 else price + (n - 1) * (al - ag / rs)


def target_sma(price, ag, al, og, ol, t_rsi, n):
    if t_rsi <= 0 or t_rsi >= 100: return None
    rs = t_rsi / (100 - t_rsi)
    sg, sl = ag * n, al * n
    if t_rsi >= _cur_rsi(ag, al):
        return price + rs * (sl - ol) - sg + og
    return None if rs == 0 else price + (sl - ol) - (sg - og) / rs


def target_ema(price, ag, al, t_rsi, n):
    if t_rsi <= 0 or t_rsi >= 100: return None
    rs = t_rsi / (100 - t_rsi)
    k = (n - 1) / 2
    if t_rsi >= _cur_rsi(ag, al):
        return price + k * (rs * al - ag)
    return None if rs == 0 else price + k * (al - ag / rs)


# ── 유틸 ──────────────────────────────────────────────────────────────────────

FIXED_RSI = [25, 30, 50, 70, 75]


def make_target_list(rsi_series):
    mn = float(rsi_series.dropna().min())
    mx = float(rsi_series.dropna().max())
    return sorted({mn, *map(float, FIXED_RSI), mx})


def build_table(t_list, price, calc_fn):
    rows = []
    for t in t_list:
        tp = calc_fn(t)
        if tp is None or tp <= 0:
            rows.append({"target_rsi": round(t, 2), "price": None, "change_pct": None, "direction": "-"})
        else:
            pct = (tp - price) / price * 100
            rows.append({
                "target_rsi": round(t, 2),
                "price": round(tp, 4),
                "change_pct": round(pct, 2),
                "direction": "▲ 상승" if tp > price else ("▼ 하락" if tp < price else "─"),
            })
    return rows


def s2list(series):
    return [None if pd.isna(v) else float(v) for v in series]


def idx2str(index):
    try:
        return [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in index]
    except Exception:
        return [str(d) for d in index]


def resolve_ticker(ticker: str) -> str:
    if "." in ticker or ticker.startswith("^"):
        return ticker
    if not re.match(r"^\d[0-9A-Za-z]{5}$", ticker):
        return ticker
    for suffix in [".KS", ".KQ"]:
        try:
            if not yf.Ticker(ticker + suffix).history(period="5d").empty:
                return ticker + suffix
        except Exception:
            pass
    return ticker


# ── Handler ───────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            params = parse_qs(urlparse(self.path).query)

            ticker_raw = params.get("ticker", ["^GSPC"])[0].strip()
            period_rsi = int(params.get("period", ["14"])[0])
            interval   = params.get("interval",  ["1d"])[0]
            lookback   = params.get("lookback",  ["1y"])[0]

            resolved = resolve_ticker(ticker_raw)

            hist = yf.Ticker(resolved).history(period=lookback, interval=interval)
            if hist.empty:
                return self._err(404, f"데이터 없음: {ticker_raw}")

            close = hist["Close"].dropna()
            if len(close) < period_rsi + 1:
                return self._err(400, f"데이터 부족: 최소 {period_rsi + 1}봉 필요")

            # RSI 계산
            rsi_w, ag_w, al_w             = calc_rsi_wilder(close, period_rsi)
            rsi_s, ag_s, al_s, og_s, ol_s = calc_rsi_sma(close, period_rsi)
            rsi_e, ag_e, al_e             = calc_rsi_ema(close, period_rsi)

            price  = float(close.iloc[-1])
            cr_w   = float(rsi_w.dropna().iloc[-1])
            cr_s   = float(rsi_s.dropna().iloc[-1])
            cr_e   = float(rsi_e.dropna().iloc[-1])
            date_s = close.index[-1].strftime("%Y-%m-%d") if hasattr(close.index[-1], "strftime") else str(close.index[-1])

            # 스칼라 추출
            def last(s): return float(s.dropna().iloc[-1])

            ag_wv, al_wv = last(ag_w), last(al_w)
            ag_sv, al_sv = last(ag_s), last(al_s)
            og_sv, ol_sv = last(og_s), last(ol_s)
            ag_ev, al_ev = last(ag_e), last(al_e)

            tl_w = make_target_list(rsi_w)
            tl_s = make_target_list(rsi_s)
            tl_e = make_target_list(rsi_e)

            # 타겟 라인 (Wilder 기준으로 차트 수평선)
            target_lines = []
            for t in tl_w:
                tp = target_wilder(price, ag_wv, al_wv, t, period_rsi)
                target_lines.append({
                    "rsi": round(t, 2),
                    "price": round(tp, 4) if tp and tp > 0 else None,
                    "change_pct": round((tp - price) / price * 100, 2) if tp and tp > 0 else None,
                    "is_fixed": t in FIXED_RSI,
                })

            # MA
            MA_PERIODS = [20, 60, 125, 200, 240, 365]
            ma_data = {}
            for p in MA_PERIODS:
                ma = close.rolling(p).mean()
                if ma.dropna().shape[0] > 0:
                    ma_data[str(p)] = s2list(ma)

            result = {
                "ticker":      ticker_raw,
                "resolved":    resolved,
                "current_price": price,
                "date":        date_s,
                "interval":    interval,
                "lookback":    lookback,
                "period_rsi":  period_rsi,
                "rsi": {
                    "wilder": round(cr_w, 2),
                    "cutler": round(cr_s, 2),
                    "ema":    round(cr_e, 2),
                },
                "tables": {
                    "wilder": build_table(tl_w, price, lambda t: target_wilder(price, ag_wv, al_wv, t, period_rsi)),
                    "cutler": build_table(tl_s, price, lambda t: target_sma(price, ag_sv, al_sv, og_sv, ol_sv, t, period_rsi)),
                    "ema":    build_table(tl_e, price, lambda t: target_ema(price, ag_ev, al_ev, t, period_rsi)),
                },
                "chart": {
                    "dates":      idx2str(hist.index),
                    "open":       s2list(hist["Open"]),
                    "high":       s2list(hist["High"]),
                    "low":        s2list(hist["Low"]),
                    "close":      s2list(close),
                    "rsi_wilder": s2list(rsi_w),
                    "rsi_cutler": s2list(rsi_s),
                    "rsi_ema":    s2list(rsi_e),
                    "ma":         ma_data,
                    "target_lines": target_lines,
                },
            }

            self._ok(result)

        except Exception as e:
            self._err(500, str(e))

    def _ok(self, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(200)
        self._headers(len(body))
        self.wfile.write(body)

    def _err(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self._headers(len(body))
        self.wfile.write(body)

    def _headers(self, length):
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(length))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def log_message(self, *_):
        pass
