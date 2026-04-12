'use client';

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyChart';
import type { AnalysisData } from '@/lib/types';

const MA_COLORS: Record<string, string> = {
  '20': '#ff4444', '60': '#00cc44', '125': '#3399ff',
  '200': '#ffee00', '240': '#ff8800', '365': '#cccccc',
};

const BASE_LAYOUT = {
  paper_bgcolor: '#000000',
  plot_bgcolor:  '#0d1117',
  font: { color: '#e0e0e0', size: 12 },
  margin: { l: 10, r: 85, t: 30, b: 10 },
  legend: { orientation: 'h', y: 1.02, font: { size: 11 } },
  xaxis: { showgrid: false, rangeslider: { visible: false } },
  yaxis:  { title: '가격', domain: [0.38, 1], showgrid: true, gridcolor: '#1e2535' },
  yaxis2: { title: 'RSI', domain: [0, 0.34], range: [0, 100], showgrid: true, gridcolor: '#1e2535' },
};

export function MainChart({ data }: { data: AnalysisData }) {
  const { traces, layout } = useMemo(() => {
    const c = data.chart;
    const traces = [];

    // Candlestick
    traces.push({
      type: 'candlestick', x: c.dates,
      open: c.open, high: c.high, low: c.low, close: c.close,
      name: '가격',
      increasing: { line: { color: '#26a69a' } },
      decreasing: { line: { color: '#ef5350' } },
      xaxis: 'x', yaxis: 'y',
    });

    // Moving averages
    Object.entries(c.ma).forEach(([p, vals]) => {
      traces.push({
        type: 'scatter', x: c.dates, y: vals,
        name: `MA${p}`,
        line: { color: MA_COLORS[p] ?? '#888', width: 1 },
        opacity: 0.8, xaxis: 'x', yaxis: 'y',
      });
    });

    // RSI lines
    [
      { key: 'rsi_wilder', color: '#4fc3f7', name: `Wilder(${data.period_rsi})` },
      { key: 'rsi_cutler', color: '#a5d6a7', name: `Cutler(${data.period_rsi})` },
      { key: 'rsi_ema',    color: '#ce93d8', name: `EMA(${data.period_rsi})` },
    ].forEach(r => {
      traces.push({
        type: 'scatter', x: c.dates, y: c[r.key as keyof typeof c] as number[],
        name: r.name, line: { color: r.color, width: 1.5 },
        xaxis: 'x', yaxis: 'y2',
      });
    });

    // Shapes + annotations
    const shapes: object[] = [];
    const annotations: object[] = [];
    const xEnd = c.dates[c.dates.length - 1];
    const xStart = c.dates[0];

    const addHline = (y: number, color: string, dash: string, label: string) => {
      shapes.push({ type: 'line', x0: xStart, x1: xEnd, y0: y, y1: y, xref: 'x', yref: 'y', line: { color, width: 1.5, dash } });
      annotations.push({ x: 1, xref: 'paper', y, yref: 'y', text: label, showarrow: false, xanchor: 'left', font: { color, size: 10 } });
    };

    // Current price line
    addHline(data.current_price, '#ffeb3b', 'solid', `현재 ${fmtPrice(data.current_price)}`);

    // Target RSI lines
    c.target_lines.forEach(tl => {
      if (!tl.price) return;
      const color = tl.rsi >= 70 ? '#ef9a9a' : tl.rsi <= 30 ? '#4fc3f7' : '#bdbdbd';
      const pctStr = tl.change_pct != null ? `${tl.change_pct >= 0 ? '+' : ''}${tl.change_pct.toFixed(1)}%` : '';
      shapes.push({ type: 'line', x0: xStart, x1: xEnd, y0: tl.price, y1: tl.price, xref: 'x', yref: 'y', line: { color, width: 1, dash: tl.is_fixed ? 'dot' : 'dash' } });
      annotations.push({ x: 1, xref: 'paper', y: tl.price, yref: 'y', text: `RSI ${tl.rsi}  (${pctStr})`, showarrow: false, xanchor: 'left', font: { color, size: 10 } });
    });

    // RSI reference lines
    ([70, 50, 30] as const).forEach(lvl => {
      const color = lvl === 70 ? 'rgba(239,83,80,.5)' : lvl === 30 ? 'rgba(38,166,154,.5)' : 'rgba(158,158,158,.4)';
      shapes.push({ type: 'line', x0: xStart, x1: xEnd, y0: lvl, y1: lvl, xref: 'x', yref: 'y2', line: { color, width: 1, dash: 'dot' } });
    });

    const layout = { ...BASE_LAYOUT, shapes, annotations };
    return { traces, layout };
  }, [data]);

  return <PlotlyChart data={traces} layout={layout} height={750} />;
}

function fmtPrice(v: number) {
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 10)   return v.toFixed(2);
  return v.toPrecision(5);
}
