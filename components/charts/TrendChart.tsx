'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import type { IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import { LWChart } from './LWChart';
import { useChartSync } from '@/lib/useChartSync';
import {
  toCandleData, toLineData, toHistogramData,
  buildGradientStyle, macdColor,
} from '@/lib/chartUtils';
import type { TrendData } from '@/lib/types';

const PANE1_H = 392;
const PANE2_H = 151;

export function TrendChart({ data, ticker }: { data: TrendData; ticker: string }) {
  const [readyCount, setReadyCount] = useState(0);
  const syncCharts = useRef<(IChartApi | null)[]>([null, null]);
  useChartSync(readyCount === 2 ? syncCharts.current : []);

  // 시리즈 ref (데이터 업데이트용)
  const candleRef   = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma20Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const stRef       = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdRef     = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef   = useRef<ISeriesApi<'Line'> | null>(null);

  const gradStyle = buildGradientStyle(data.is_up);

  // ── 패인1 초기화 ──────────────────────────────────────────────────────────
  const onChart1Ready = useCallback((chart: IChartApi) => {
    syncCharts.current[0] = chart;

    const candle = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    candle.setData(toCandleData(data.dates, data.open, data.high, data.low, data.close));
    candleRef.current = candle;

    // 신호 마커 (time 오름차순 정렬 필수)
    const markers = data.signals
      .map(s => ({
        time: s.date as import('lightweight-charts').Time,
        position: s.side === 'DOWN' ? 'aboveBar' as const : 'belowBar' as const,
        shape:  s.side === 'UP'     ? 'arrowUp' as const
              : s.side === 'DOWN'   ? 'arrowDown' as const
              : 'circle' as const,
        color:  s.side === 'UP'     ? '#00e676'
              : s.side === 'DOWN'   ? '#ff5252'
              : '#ffd700',
        text:   s.side === 'BOTTOM' ? 'BOT' : '',
        size: 1,
      }))
      .sort((a, b) => String(a.time) < String(b.time) ? -1 : 1);
    candle.setMarkers(markers);

    const ma20 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma20.setData(toLineData(data.dates, data.ma20));
    ma20Ref.current = ma20;

    const ma60 = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma60.setData(toLineData(data.dates, data.ma60));
    ma60Ref.current = ma60;

    const st = chart.addLineSeries({ color: 'rgba(255,255,255,.3)', lineWidth: 1, lineStyle: 2 as LineStyle, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    st.setData(toLineData(data.dates, data.supertrend));
    stRef.current = st;

    setReadyCount((n: number) => n + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인2 초기화 ──────────────────────────────────────────────────────────
  const onChart2Ready = useCallback((chart: IChartApi) => {
    syncCharts.current[1] = chart;

    const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, base: 0 });
    hist.setData(toHistogramData(data.dates, data.macd_hist, macdColor));
    macdHistRef.current = hist;

    const macd = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    macd.setData(toLineData(data.dates, data.macd));
    macdRef.current = macd;

    const sig = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    sig.setData(toLineData(data.dates, data.macd_signal));
    signalRef.current = sig;

    setReadyCount((n: number) => n + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 데이터 변경 시 재렌더 ────────────────────────────────────────────────
  useEffect(() => {
    candleRef.current?.setData(toCandleData(data.dates, data.open, data.high, data.low, data.close));
    ma20Ref.current?.setData(toLineData(data.dates, data.ma20));
    ma60Ref.current?.setData(toLineData(data.dates, data.ma60));
    stRef.current?.setData(toLineData(data.dates, data.supertrend));
    macdHistRef.current?.setData(toHistogramData(data.dates, data.macd_hist, macdColor));
    macdRef.current?.setData(toLineData(data.dates, data.macd));
    signalRef.current?.setData(toLineData(data.dates, data.macd_signal));
  }, [data]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative" style={{ background: gradStyle }}>
        <span className="absolute top-1 left-2 z-10 text-xs text-gray-500 pointer-events-none">
          {ticker.toUpperCase()} — Trend Vision (주봉)
        </span>
        <LWChart
          height={PANE1_H}
          onChartReady={onChart1Ready}
          options={{ layout: { background: { color: 'transparent' } } }}
        />
      </div>
      <div className="relative">
        <span className="absolute top-1 left-2 z-10 text-xs text-gray-500 pointer-events-none">
          MACD
        </span>
        <LWChart
          height={PANE2_H}
          onChartReady={onChart2Ready}
          options={{ timeScale: { visible: true } }}
        />
      </div>
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
          {'sub' in item && item.sub && <div className="text-xs mt-0.5" style={{ color: item.subColor }}>{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
