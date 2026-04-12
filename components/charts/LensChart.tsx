'use client';

import { useRef, useCallback, useState } from 'react';
import type { IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import { LWChart } from './LWChart';
import { useChartSync } from '@/lib/useChartSync';
import {
  toCandleData, toLineData, toHistogramData,
  buildGradientStyle, macdColor,
} from '@/lib/chartUtils';
import type { LensData } from '@/lib/types';

const HEIGHTS = [248, 101, 101, 101, 101, 74, 83] as const;
const LABELS  = ['', 'RSI(14)', 'MACD', 'BB %B', 'Stoch(14)', 'CCI(20)', 'ADX(14)'] as const;

/** 라인 시리즈 추가 헬퍼 */
function addLine(
  chart: IChartApi,
  dates: string[],
  values: (number | null)[],
  color: string,
  lineWidth: 1 | 2 | 3 | 4,
  lineStyle?: LineStyle,
): ISeriesApi<'Line'> {
  const s = chart.addLineSeries({
    color, lineWidth,
    ...(lineStyle != null ? { lineStyle } : {}),
    priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  });
  s.setData(toLineData(dates, values));
  return s;
}

/** 수평 기준선 */
function addHline(series: ISeriesApi<'Line'>, price: number, color: string) {
  series.createPriceLine({
    price, color, lineWidth: 1,
    lineStyle: 3 as LineStyle,
    axisLabelVisible: false, title: '',
  });
}

export function LensChart({ data, ticker }: { data: LensData; ticker: string }) {
  const chartsRef = useRef<(IChartApi | null)[]>(Array(7).fill(null));
  const readyCnt  = useRef(0);
  const [syncList, setSyncList] = useState<(IChartApi | null)[]>([]);
  useChartSync(syncList);

  const gradStyle = buildGradientStyle(data.is_up);

  /** 7번째 패인이 준비되면 동기화 목록을 state에 저장 → useChartSync 활성화 */
  const onPaneReady = useCallback((chart: IChartApi, idx: number) => {
    chartsRef.current[idx] = chart;
    readyCnt.current += 1;
    if (readyCnt.current === 7) {
      setSyncList([...chartsRef.current]);
    }
  }, []);

  // ── 패인1: 캔들 + MA + BB ─────────────────────────────────────────────────
  const onPane1Ready = useCallback((chart: IChartApi) => {
    const candle = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    candle.setData(toCandleData(data.dates, data.open, data.high, data.low, data.close));

    // 신호 마커 (time 오름차순 정렬 필수)
    const markers = data.signals
      .map(s => ({
        time: s.date as import('lightweight-charts').Time,
        position: s.side === 'DOWN' ? 'aboveBar' as const : 'belowBar' as const,
        shape:  s.side === 'UP'   ? 'arrowUp'   as const
              : s.side === 'DOWN' ? 'arrowDown'  as const
              : 'circle' as const,
        color:  s.side === 'UP'   ? '#00e676'
              : s.side === 'DOWN' ? '#ff5252'
              : '#ffd700',
        size: Math.min(3, 1 + Math.round(Math.abs(s.score ?? 0) / 3)),
        text: '',
      }))
      .sort((a, b) => String(a.time) < String(b.time) ? -1 : 1);
    candle.setMarkers(markers);

    addLine(chart, data.dates, data.ma20,     '#f59e0b', 1);
    addLine(chart, data.dates, data.ma60,     '#60a5fa', 1);
    addLine(chart, data.dates, data.bb_upper, 'rgba(147,51,234,.55)', 1, 2 as LineStyle);
    addLine(chart, data.dates, data.bb_lower, 'rgba(147,51,234,.55)', 1, 2 as LineStyle);

    onPaneReady(chart, 0);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인2: RSI ────────────────────────────────────────────────────────────
  const onPane2Ready = useCallback((chart: IChartApi) => {
    const rsi = chart.addLineSeries({
      color: '#a78bfa', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: true,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
        margins: { above: 2, below: 2 },
      }),
    });
    rsi.setData(toLineData(data.dates, data.rsi));
    addHline(rsi, 70, 'rgba(239,83,80,.55)');
    addHline(rsi, 50, 'rgba(158,158,158,.35)');
    addHline(rsi, 30, 'rgba(38,166,154,.55)');
    onPaneReady(chart, 1);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인3: MACD ───────────────────────────────────────────────────────────
  const onPane3Ready = useCallback((chart: IChartApi) => {
    const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, base: 0 });
    hist.setData(toHistogramData(data.dates, data.macd_hist, macdColor));
    addLine(chart, data.dates, data.macd,        '#60a5fa', 1);
    addLine(chart, data.dates, data.macd_signal, '#f59e0b', 1);
    onPaneReady(chart, 2);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인4: BB %B ──────────────────────────────────────────────────────────
  const onPane4Ready = useCallback((chart: IChartApi) => {
    const bbpct = chart.addLineSeries({
      color: '#c084fc', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: true,
    });
    bbpct.setData(toLineData(data.dates, data.bb_pct));
    addHline(bbpct, 1,   'rgba(239,83,80,.55)');
    addHline(bbpct, 0.5, 'rgba(158,158,158,.35)');
    addHline(bbpct, 0,   'rgba(38,166,154,.55)');
    onPaneReady(chart, 3);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인5: Stoch ──────────────────────────────────────────────────────────
  const onPane5Ready = useCallback((chart: IChartApi) => {
    const k = chart.addLineSeries({
      color: '#f472b6', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: true,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
        margins: { above: 2, below: 2 },
      }),
    });
    k.setData(toLineData(data.dates, data.stoch_k));
    addHline(k, 80, 'rgba(239,83,80,.55)');
    addHline(k, 20, 'rgba(38,166,154,.55)');
    addLine(chart, data.dates, data.stoch_d, '#fb923c', 1);
    onPaneReady(chart, 4);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인6: CCI ────────────────────────────────────────────────────────────
  const onPane6Ready = useCallback((chart: IChartApi) => {
    const cciColorFn = (v: number) => v >= 0 ? '#26a69a' : '#ef5350';
    const cci = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, base: 0 });
    cci.setData(toHistogramData(data.dates, data.cci, cciColorFn));

    // 기준선용 투명 라인 (createPriceLine 사용)
    const ref = chart.addLineSeries({ color: 'transparent', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ref.setData(toLineData(data.dates, data.cci));
    addHline(ref,  100, 'rgba(239,83,80,.55)');
    addHline(ref, -100, 'rgba(38,166,154,.55)');

    onPaneReady(chart, 5);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인7: ADX ────────────────────────────────────────────────────────────
  const onPane7Ready = useCallback((chart: IChartApi) => {
    const adx = addLine(chart, data.dates, data.adx,      '#fbbf24', 2);
    addLine(chart, data.dates, data.plus_di,  '#34d399', 1);
    addLine(chart, data.dates, data.minus_di, '#f87171', 1);
    addHline(adx, 25, 'rgba(255,255,255,.2)');
    onPaneReady(chart, 6);
  }, [data, onPaneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlers = [
    onPane1Ready, onPane2Ready, onPane3Ready,
    onPane4Ready, onPane5Ready, onPane6Ready, onPane7Ready,
  ];

  return (
    <div className="flex flex-col gap-3">
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="relative"
          style={i === 0 ? { background: gradStyle } : undefined}
        >
          <span className="absolute top-1 left-2 z-10 text-xs text-gray-500 pointer-events-none">
            {i === 0 ? `${ticker.toUpperCase()} — Multi Lens (일봉)` : LABELS[i]}
          </span>
          <LWChart
            height={h}
            onChartReady={handlers[i]}
            options={
              i === 0 ? { layout: { background: { color: 'transparent' } } }
            : i === 6 ? { timeScale: { visible: true } }
            : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
