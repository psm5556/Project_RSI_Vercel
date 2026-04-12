'use client';

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyChart';
import type { TrendData } from '@/lib/types';

const BASE = {
  paper_bgcolor: '#000000', plot_bgcolor: '#0d1117',
  font: { color: '#e0e0e0', size: 12 },
  margin: { l: 10, r: 10, t: 45, b: 10 },
  legend: { orientation: 'h', y: 1.02, font: { size: 11 } },
};

function bgBands(dates: string[], isUp: boolean[]) {
  const shapes: object[] = [];
  let i = 0;
  while (i < dates.length) {
    let j = i + 1;
    while (j < dates.length && isUp[j] === isUp[i]) j++;
    shapes.push({
      type: 'rect', x0: dates[i], x1: dates[j - 1], y0: 0, y1: 1, yref: 'paper',
      fillcolor: isUp[i] ? 'rgba(0,160,0,.1)' : 'rgba(200,0,0,.1)',
      layer: 'below', line: { width: 0 },
    });
    i = j;
  }
  return shapes;
}

export function TrendChart({ data, ticker }: { data: TrendData; ticker: string }) {
  const { traces, layout } = useMemo(() => {
    const traces = [];
    const annotations: object[] = [];

    traces.push({
      type: 'candlestick', x: data.dates,
      open: data.open, high: data.high, low: data.low, close: data.close,
      increasing: { line: { color: '#26a69a' } }, decreasing: { line: { color: '#ef5350' } },
      showlegend: false, xaxis: 'x', yaxis: 'y',
    });
    traces.push({ type: 'scatter', x: data.dates, y: data.ma20, name: 'MA20', line: { color: '#f59e0b', width: 1.2 }, xaxis: 'x', yaxis: 'y' });
    traces.push({ type: 'scatter', x: data.dates, y: data.ma60, name: 'MA60', line: { color: '#60a5fa', width: 1.2 }, xaxis: 'x', yaxis: 'y' });
    traces.push({ type: 'scatter', x: data.dates, y: data.supertrend, name: 'ST', showlegend: false, line: { color: 'rgba(255,255,255,.3)', width: 1, dash: 'dot' }, xaxis: 'x', yaxis: 'y' });

    data.signals.forEach(s => {
      if (s.side === 'UP')     annotations.push({ x: s.date, y: s.price * 0.993, text: '▲ UP',     showarrow: false, font: { color: '#00e676', size: 10, family: 'Arial Black' } });
      if (s.side === 'DOWN')   annotations.push({ x: s.date, y: s.price * 1.007, text: '▼ DOWN',   showarrow: false, font: { color: '#ff5252', size: 10, family: 'Arial Black' } });
      if (s.side === 'BOTTOM') annotations.push({ x: s.date, y: s.price * 0.986, text: '◆ BOTTOM', showarrow: false, font: { color: '#ffd700', size: 11, family: 'Arial Black' } });
    });

    const barClr = data.macd_hist.map(v => (v == null || v >= 0 ? '#26a69a' : '#ef5350'));
    traces.push({ type: 'bar',     x: data.dates, y: data.macd_hist,   marker: { color: barClr }, showlegend: false, xaxis: 'x', yaxis: 'y2' });
    traces.push({ type: 'scatter', x: data.dates, y: data.macd,        name: 'MACD',   showlegend: false, line: { color: '#60a5fa', width: 1 }, xaxis: 'x', yaxis: 'y2' });
    traces.push({ type: 'scatter', x: data.dates, y: data.macd_signal, name: 'Signal', showlegend: false, line: { color: '#f59e0b', width: 1 }, xaxis: 'x', yaxis: 'y2' });

    const layout = {
      ...BASE,
      title: { text: `${ticker.toUpperCase()} — Trend Vision (주봉)`, font: { size: 14 } },
      xaxis:  { showgrid: false, rangeslider: { visible: false } },
      yaxis:  { domain: [0.3, 1], showgrid: true, gridcolor: '#1e2535' },
      yaxis2: { domain: [0, 0.27], showgrid: true, gridcolor: '#1e2535' },
      shapes: bgBands(data.dates, data.is_up),
      annotations,
    };
    return { traces, layout };
  }, [data, ticker]);

  return (
    <div>
      <PlotlyChart data={traces} layout={layout} height={560} />
      <TrendSummary summary={data.summary} />
    </div>
  );
}

function TrendSummary({ summary: s }: { summary: TrendData['summary'] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
      {[
        { label: '추세', value: s.is_up ? '📈 상승' : '📉 하락', color: s.is_up ? '#80cbc4' : '#ef9a9a' },
        { label: 'RSI(14)', value: s.rsi.toFixed(1) },
        { label: 'MACD', value: s.macd.toFixed(4), sub: `${s.macd_hist >= 0 ? '+' : ''}${s.macd_hist.toFixed(4)}`, subColor: s.macd_hist >= 0 ? '#80cbc4' : '#ef9a9a' },
        ...(s.vs_ma20 != null ? [{ label: 'vs MA20', value: `${s.vs_ma20 >= 0 ? '+' : ''}${s.vs_ma20.toFixed(2)}%`, color: s.vs_ma20 >= 0 ? '#ef9a9a' : '#80cbc4' }] : []),
        ...(s.vs_ma60 != null ? [{ label: 'vs MA60', value: `${s.vs_ma60 >= 0 ? '+' : ''}${s.vs_ma60.toFixed(2)}%`, color: s.vs_ma60 >= 0 ? '#ef9a9a' : '#80cbc4' }] : []),
      ].map((item, i) => (
        <div key={i} className="bg-app-card border border-app-border rounded-lg p-3">
          <div className="text-xs text-app-muted uppercase tracking-wide mb-1">{item.label}</div>
          <div className="font-bold text-sm" style={{ color: item.color ?? '#fff' }}>{item.value}</div>
          {item.sub && <div className="text-xs mt-0.5" style={{ color: item.subColor }}>{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
