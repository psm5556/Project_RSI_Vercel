'use client';

import type { AnalysisData } from '@/lib/types';

const INTERVAL_LABEL: Record<string, string> = {
  '1d': '일봉', '1wk': '주봉', '1mo': '월봉',
  '1h': '1시간', '4h': '4시간', '15m': '15분',
};

function rsiBadge(v: number) {
  if (v >= 70) return { text: '🔴 과매수', cls: 'bg-red-900/30 text-red-300' };
  if (v <= 30) return { text: '🟢 과매도', cls: 'bg-teal-900/30 text-teal-300' };
  return { text: '⚪ 중립', cls: 'bg-gray-800 text-gray-400' };
}

function fmtPrice(v: number) {
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 10)   return v.toFixed(2);
  return v.toPrecision(5);
}

export function MetricsGrid({ data }: { data: AnalysisData }) {
  const ivLabel = INTERVAL_LABEL[data.interval] ?? data.interval;

  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 flex-wrap">
        <span>{data.resolved.toUpperCase()}</span>
        <span className="text-sm font-normal text-app-muted">{ivLabel} · {data.date}</span>
        {data.ticker !== data.resolved && (
          <span className="text-xs text-app-muted">({data.ticker} → {data.resolved})</span>
        )}
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Price */}
        <div className="bg-app-card border border-app-border rounded-xl p-4">
          <div className="text-xs text-app-muted uppercase tracking-wide mb-2">현재 가격</div>
          <div className="text-2xl font-bold text-white">{fmtPrice(data.current_price)}</div>
        </div>

        {/* RSI metrics */}
        {[
          { label: 'Wilder RSI', value: data.rsi.wilder },
          { label: 'Cutler RSI (SMA)', value: data.rsi.cutler },
          { label: 'EMA RSI', value: data.rsi.ema },
        ].map(m => {
          const badge = rsiBadge(m.value);
          return (
            <div key={m.label} className="bg-app-card border border-app-border rounded-xl p-4">
              <div className="text-xs text-app-muted uppercase tracking-wide mb-2">{m.label}</div>
              <div className="text-2xl font-bold text-white">{m.value.toFixed(2)}</div>
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
