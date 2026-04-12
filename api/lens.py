"""
/api/lens  — Multi Lens (일봉): 7개 지표 패널
Query params: ticker, lookback (default 2y)
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

import yfinance as yf
import pandas as pd
import numpy as np


def _supertrend(high, low, close, period=14, multiplier=3.0):
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
    raw_u = hl2 + multiplier * atr
    raw_l = hl2 - multiplier * atr
    u, l2 = raw_u.copy(), raw_l.copy()
    st = np.zeros(n); is_up = np.ones(n, dtype=bool)
    st[0] = l2[0]
    for i in range(1, n):
        l2[i] = raw_l[i] if (raw_l[i] > l2[i-1] or c[i-1] < l2[i-1]) else l2[i-1]
        u[i]  = raw_u[i] if (raw_u[i] < u[i-1]  or c[i-1] > u[i-1])  else u[i-1]
        is_up[i] = (c[i] >= l2[i]) if is_up[i-1] else (c[i] > u[i])
        st[i] = l2[i] if is_up[i] else u[i]
    return pd.Series(st, index=close.index), pd.Series(is_up, index=close.index)


def _filter_gap(mask, gap=5):
    result = mask.copy(); last = -gap
    for i, (idx, v) in enumerate(mask.items()):
        if v:
            if i - last < gap: result[idx] = False
            else: last = i
    return result


def s2list(s): return [None if pd.isna(v) else float(v) for v in s]
def b2list(s): return [bool(v) for v in s]
def idx2str(idx):
    try: return [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in idx]
    except: return [str(d) for d in idx]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            params   = parse_qs(urlparse(self.path).query)
            ticker   = params.get("ticker",  ["^GSPC"])[0].strip()
            lookback = params.get("lookback", ["2y"])[0]

            hist = yf.Ticker(ticker).history(period=lookback, interval="1d")
            if hist.empty:
                return self._err(404, f"데이터 없음: {ticker}")

            close  = hist["Close"].dropna()
            high   = hist["High"]
            low    = hist["Low"]
            volume = hist.get("Volume", pd.Series(np.nan, index=close.index))
            dates  = hist.index

            # Supertrend
            st_line, is_up = _supertrend(high, low, close)

            # RSI
            delta = close.diff()
            ag = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
            al = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
            rsi = 100 - 100 / (1 + ag / al.replace(0, np.nan))

            # MACD
            ema12  = close.ewm(span=12, adjust=False).mean()
            ema26  = close.ewm(span=26, adjust=False).mean()
            macd   = ema12 - ema26
            sig    = macd.ewm(span=9, adjust=False).mean()
            hist_m = macd - sig

            # Bollinger Bands
            ma20  = close.rolling(20).mean()
            std20 = close.rolling(20).std()
            bb_u  = ma20 + 2 * std20
            bb_l  = ma20 - 2 * std20
            bb_pct = ((close - bb_l) / (bb_u - bb_l).replace(0, np.nan)).clip(-0.5, 1.5)

            # Stochastic
            lo14    = low.rolling(14).min()
            hi14    = high.rolling(14).max()
            stoch_k = ((close - lo14) / (hi14 - lo14).replace(0, np.nan) * 100).clip(0, 100)
            stoch_d = stoch_k.rolling(3).mean()

            # CCI
            tp     = (high + low + close) / 3
            ma_tp  = tp.rolling(20).mean()
            md_tp  = tp.rolling(20).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
            cci    = (tp - ma_tp) / (0.015 * md_tp.replace(0, np.nan))

            # ADX
            h_diff  = high.diff()
            l_diff  = -low.diff()
            pdm = pd.Series(np.where((h_diff > l_diff) & (h_diff > 0), h_diff, 0.0), index=close.index)
            mdm = pd.Series(np.where((l_diff > h_diff) & (l_diff > 0), l_diff, 0.0), index=close.index)
            prev_c  = close.shift(1)
            tr_raw  = pd.concat([high - low, (high - prev_c).abs(), (low - prev_c).abs()], axis=1).max(axis=1)
            atr14   = tr_raw.ewm(alpha=1/14, adjust=False).mean()
            plus_di  = 100 * pdm.ewm(alpha=1/14, adjust=False).mean() / atr14
            minus_di = 100 * mdm.ewm(alpha=1/14, adjust=False).mean() / atr14
            dx       = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
            adx      = dx.ewm(alpha=1/14, adjust=False).mean()

            # MA60, Volume ratio
            ma60      = close.rolling(60).mean()
            vol_ma20  = volume.rolling(20).mean().replace(0, np.nan)
            vol_ratio = (volume / vol_ma20).replace([np.inf, -np.inf], np.nan)

            # 다중신호 스코어 (-7 ~ +7)
            score = (
                np.sign(rsi - 50).fillna(0)
                + np.sign(hist_m).fillna(0)
                + np.sign(stoch_k - 50).fillna(0)
                + np.sign(close / ma20.replace(0, np.nan) - 1).fillna(0)
                + np.sign(close / ma60.replace(0, np.nan) - 1).fillna(0)
                + np.sign(bb_pct - 0.5).fillna(0)
                + np.sign(vol_ratio - 1).fillna(0)
            )

            up_flip  = is_up & (~is_up.shift(1).fillna(True))
            dn_flip  = (~is_up) & (is_up.shift(1).fillna(False))
            score_up = (score >= 4) & (score.shift(1).fillna(0) < 4)
            score_dn = (score <= -4) & (score.shift(1).fillna(0) > -4)
            up_sig   = _filter_gap(up_flip | score_up, 5)
            dn_sig   = _filter_gap(dn_flip | score_dn, 5)

            def sig_pts(mask, price_s, side):
                pts = []
                for i, (idx, v) in enumerate(mask.items()):
                    if v:
                        sc = int(score.iloc[i]) if i < len(score) else 0
                        pts.append({
                            "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                            "price": float(price_s.iloc[i]),
                            "side": side,
                            "score": sc,
                        })
                return pts

            signals = sig_pts(up_sig, low, "UP") + sig_pts(dn_sig, high, "DOWN")

            result = {
                "dates":      idx2str(dates),
                "open":       s2list(hist["Open"]),
                "high":       s2list(high),
                "low":        s2list(low),
                "close":      s2list(close),
                "supertrend": s2list(st_line),
                "is_up":      b2list(is_up),
                "rsi":        s2list(rsi),
                "macd":       s2list(macd),
                "macd_signal":s2list(sig),
                "macd_hist":  s2list(hist_m),
                "bb_upper":   s2list(bb_u),
                "bb_lower":   s2list(bb_l),
                "bb_pct":     s2list(bb_pct),
                "stoch_k":    s2list(stoch_k),
                "stoch_d":    s2list(stoch_d),
                "cci":        s2list(cci),
                "adx":        s2list(adx),
                "plus_di":    s2list(plus_di),
                "minus_di":   s2list(minus_di),
                "ma20":       s2list(ma20),
                "ma60":       s2list(ma60),
                "score":      s2list(score),
                "signals":    signals,
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
