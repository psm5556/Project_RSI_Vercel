'use client';

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyChart';
import type { LensData } from '@/lib/types';

const BASE = {
  paper_bgcolor: '#000000', plot_bgcolor: '#0d1117',
  font: { color: '#e0e0e0', size: 11 },
  margin: { l: 10, r: 10, t: 45, b: 10 },
  legend: { orientation: 'h', y: 1.01, font: { size: 11 } },
};

function bgBands(dates: string[], isUp: boolean[]) {
  const shapes: object[] = [];
  let i = 0;
  while (i < dates.length) {
    let j = i + 1;
    while (j < dates.length && isUp[j] === isUp[i]) j++;
    shapes.push({ type: 'rect', x0: dates[i], x1: dates[j - 1], y0: 0, y1: 1, yref: 'paper', fillcolor: isUp[i] ? 'rgba(0,160,0,.1)' : 'rgba(200,0,0,.1)', layer: 'below', line: { width: 0 } });
    i = j;
  }
  return shapes;
}

const DOMAINS = [[0.73, 1], [0.60, 0.71], [0.47, 0.58], [0.34, 0.45], [0.21, 0.32], [0.11, 0.19], [0, 0.09]];
const SUBTITLES = ['', 'RSI(14)', 'MACD', 'BB %B', 'Stoch(14)', 'CCI(20)', 'ADX(14)'];

function ax(n: number) { return n === 1 ? 'x' : `x${n}`; }
function ay(n: number) { return n === 1 ? 'y' : `y${n}`; }

export function LensChart({ data, ticker }: { data: LensData; ticker: string }) {
  const { traces, layout } = useMemo(() => {
    const traces = [];
    const annotations: object[] = [];
    const xEnd = data.dates[data.dates.length - 1];

    data.signals.forEach(s => {
      const sz = Math.min(16, 9 + Math.abs(s.score ?? 0));
      if (s.side === 'UP')   annotations.push({ x: s.date, y: s.price * 0.995, text: '▲ UP',   showarrow: false, font: { color: '#00e676', size: sz, family: 'Arial Black' } });
      if (s.side === 'DOWN') annotations.push({ x: s.date, y: s.price * 1.005, text: '▼ DOWN', showarrow: false, font: { color: '#ff5252', size: sz, family: 'Arial Black' } });
    });

    // P1: Candle
    traces.push({ type: 'candlestick', x: data.dates, open: data.open, high: data.high, low: data.low, close: data.close, increasing: { line: { color: '#26a69a' } }, decreasing: { line: { color: '#ef5350' } }, showlegend: false, xaxis: ax(1), yaxis: ay(1) });
    traces.push({ type: 'scatter', x: data.dates, y: data.ma20, name: 'MA20', line: { color: '#f59e0b', width: 1.2 }, xaxis: ax(1), yaxis: ay(1) });
    traces.push({ type: 'scatter', x: data.dates, y: data.ma60, name: 'MA60', line: { color: '#60a5fa', width: 1.2 }, xaxis: ax(1), yaxis: ay(1) });
    traces.push({ type: 'scatter', x: data.dates, y: data.bb_upper, name: 'BB', line: { color: 'rgba(147,51,234,.55)', width: 1, dash: 'dot' }, xaxis: ax(1), yaxis: ay(1) });
    traces.push({ type: 'scatter', x: data.dates, y: data.bb_lower, showlegend: false, fill: 'tonexty', fillcolor: 'rgba(147,51,234,.05)', line: { color: 'rgba(147,51,234,.55)', width: 1, dash: 'dot' }, xaxis: ax(1), yaxis: ay(1) });

    // P2: RSI
    traces.push({ type: 'scatter', x: data.dates, y: data.rsi, name: 'RSI', line: { color: '#a78bfa', width: 1.5 }, showlegend: false, xaxis: ax(2), yaxis: ay(2) });

    // P3: MACD
    const barClr = data.macd_hist.map(v => v == null || v >= 0 ? '#26a69a' : '#ef5350');
    traces.push({ type: 'bar',     x: data.dates, y: data.macd_hist,   marker: { color: barClr }, showlegend: false, xaxis: ax(3), yaxis: ay(3) });
    traces.push({ type: 'scatter', x: data.dates, y: data.macd,        showlegend: false, line: { color: '#60a5fa', width: 1 }, xaxis: ax(3), yaxis: ay(3) });
    traces.push({ type: 'scatter', x: data.dates, y: data.macd_signal, showlegend: false, line: { color: '#f59e0b', width: 1 }, xaxis: ax(3), yaxis: ay(3) });

    // P4: BB%B
    traces.push({ type: 'scatter', x: data.dates, y: data.bb_pct, showlegend: false, line: { color: '#c084fc', width: 1.5 }, xaxis: ax(4), yaxis: ay(4) });

    // P5: Stoch
    traces.push({ type: 'scatter', x: data.dates, y: data.stoch_k, name: '%K', showlegend: false, line: { color: '#f472b6', width: 1.5 }, xaxis: ax(5), yaxis: ay(5) });
    traces.push({ type: 'scatter', x: data.dates, y: data.stoch_d, name: '%D', showlegend: false, line: { color: '#fb923c', width: 1 },   xaxis: ax(5), yaxis: ay(5) });

    // P6: CCI
    const cciClr = data.cci.map(v => v == null || v >= 0 ? '#26a69a' : '#ef5350');
    traces.push({ type: 'bar', x: data.dates, y: data.cci, marker: { color: cciClr }, showlegend: false, xaxis: ax(6), yaxis: ay(6) });

    // P7: ADX
    traces.push({ type: 'scatter', x: data.dates, y: data.adx,      showlegend: false, line: { color: '#fbbf24', width: 1.8 }, xaxis: ax(7), yaxis: ay(7) });
    traces.push({ type: 'scatter', x: data.dates, y: data.plus_di,  showlegend: false, line: { color: '#34d399', width: 1 },   xaxis: ax(7), yaxis: ay(7) });
    traces.push({ type: 'scatter', x: data.dates, y: data.minus_di, showlegend: false, line: { color: '#f87171', width: 1 },   xaxis: ax(7), yaxis: ay(7) });

    // Axis config
    const axisLayout: Record<string, object> = {};
    for (let i = 1; i <= 7; i++) {
      axisLayout[i === 1 ? 'xaxis' : `xaxis${i}`] = { showgrid: false, rangeslider: { visible: false }, matches: 'x' };
      axisLayout[i === 1 ? 'yaxis' : `yaxis${i}`] = { domain: DOMAINS[i - 1], showgrid: true, gridcolor: '#1e2535', title: { text: SUBTITLES[i - 1], font: { size: 10 } } };
    }
    (axisLayout['yaxis2'] as Record<string, unknown>).range = [0, 100];
    (axisLayout['yaxis5'] as Record<string, unknown>).range = [0, 100];

    // Reference hlines
    const refShapes: object[] = bgBands(data.dates, data.is_up);
    const hline = (yref: string, y: number, color: string) =>
      refShapes.push({ type: 'line', x0: data.dates[0], x1: xEnd, y0: y, y1: y, xref: 'x', yref, line: { color, width: 1, dash: 'dot' } });

    hline('y2', 70, 'rgba(239,83,80,.5)'); hline('y2', 50, 'rgba(255,255,255,.2)'); hline('y2', 30, 'rgba(38,166,154,.5)');
    hline('y4', 1, 'rgba(239,83,80,.5)');  hline('y4', .5,'rgba(255,255,255,.2)');  hline('y4', 0, 'rgba(38,166,154,.5)');
    hline('y5', 80, 'rgba(239,83,80,.5)'); hline('y5', 20, 'rgba(38,166,154,.5)');
    hline('y6', 100, 'rgba(239,83,80,.5)'); hline('y6', -100, 'rgba(38,166,154,.5)');
    hline('y7', 25, 'rgba(255,255,255,.2)');

    const layout = {
      ...BASE, ...axisLayout,
      title: { text: `${ticker.toUpperCase()} — Multi Lens (일봉)`, font: { size: 14 } },
      shapes: refShapes, annotations,
    };
    return { traces, layout };
  }, [data, ticker]);

  return <PlotlyChart data={traces} layout={layout} height={920} />;
}
