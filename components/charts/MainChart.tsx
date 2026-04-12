'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import type { IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import { LWChart } from './LWChart';
import { useChartSync } from '@/lib/useChartSync';
import {
  toCandleData, toLineData, MA_COLORS, colorForRsi, fmtPrice,
} from '@/lib/chartUtils';
import type { AnalysisData } from '@/lib/types';

const PANE1_H = 465;
const PANE2_H = 255;

export function MainChart({ data }: { data: AnalysisData }) {
  const chart1Ref = useRef<IChartApi | null>(null);
  const chart2Ref = useRef<IChartApi | null>(null);

  // 시리즈 ref (데이터 업데이트용)
  const candleRef  = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maRefs     = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const rsiRefs    = useRef<ISeriesApi<'Line'>[]>([]);

  // 두 차트 모두 준비됐을 때 sync
  const [readyCount, setReadyCount] = useState(0);
  const syncCharts = useRef<(IChartApi | null)[]>([null, null]);
  useChartSync(readyCount === 2 ? syncCharts.current : []);

  // ── 패인1 초기화 (가격 + MA + 수평선) ──────────────────────────────────────
  const onChart1Ready = useCallback((chart: IChartApi) => {
    chart1Ref.current = chart;
    syncCharts.current[0] = chart;

    const c = data.chart;

    // Candlestick
    const candle = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    candle.setData(toCandleData(c.dates, c.open, c.high, c.low, c.close));
    candleRef.current = candle;

    // 현재 가격 수평선
    candle.createPriceLine({
      price: data.current_price,
      color: '#ffeb3b',
      lineWidth: 1,
      lineStyle: 0 as LineStyle, // Solid
      axisLabelVisible: true,
      title: `현재 ${fmtPrice(data.current_price)}`,
    });

    // RSI 타겟 수평선
    c.target_lines.forEach(tl => {
      if (!tl.price) return;
      const pctStr = tl.change_pct != null
        ? `${tl.change_pct >= 0 ? '+' : ''}${tl.change_pct.toFixed(1)}%`
        : '';
      candle.createPriceLine({
        price: tl.price,
        color: colorForRsi(tl.rsi),
        lineWidth: 1,
        lineStyle: tl.is_fixed ? 3 as LineStyle : 2 as LineStyle, // Dotted : Dashed
        axisLabelVisible: true,
        title: `RSI ${tl.rsi}  (${pctStr})`,
      });
    });

    // MA 라인
    const newMaRefs = new Map<string, ISeriesApi<'Line'>>();
    Object.entries(c.ma).forEach(([period, vals]) => {
      const s = chart.addLineSeries({
        color: MA_COLORS[period] ?? '#888888',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(toLineData(c.dates, vals));
      newMaRefs.set(period, s);
    });
    maRefs.current = newMaRefs;

    setReadyCount((n: number) => n + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패인2 초기화 (RSI 3선) ─────────────────────────────────────────────────
  const onChart2Ready = useCallback((chart: IChartApi) => {
    chart2Ref.current = chart;
    syncCharts.current[1] = chart;

    const c = data.chart;
    const RSI_LINES = [
      { key: 'rsi_wilder' as const, color: '#4fc3f7', name: `Wilder(${data.period_rsi})` },
      { key: 'rsi_cutler' as const, color: '#a5d6a7', name: `Cutler(${data.period_rsi})` },
      { key: 'rsi_ema'    as const, color: '#ce93d8', name: `EMA(${data.period_rsi})` },
    ];

    const newRsiRefs: ISeriesApi<'Line'>[] = [];
    RSI_LINES.forEach(({ key, color, name }, idx) => {
      const s = chart.addLineSeries({
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: name,
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 0, maxValue: 100 },
          margins: { above: 2, below: 2 },
        }),
      });
      s.setData(toLineData(c.dates, c[key]));
      newRsiRefs.push(s);

      // 기준선 (첫 번째 시리즈에만 추가)
      if (idx === 0) {
        [
          { price: 70, color: 'rgba(239,83,80,.55)' },
          { price: 50, color: 'rgba(158,158,158,.35)' },
          { price: 30, color: 'rgba(38,166,154,.55)'  },
        ].forEach(({ price, color: c }) =>
          s.createPriceLine({
            price, color: c, lineWidth: 1,
            lineStyle: 3 as LineStyle,
            axisLabelVisible: false, title: '',
          }),
        );
      }
    });
    rsiRefs.current = newRsiRefs;

    setReadyCount((n: number) => n + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 데이터 변경 시 재렌더 ─────────────────────────────────────────────────
  useEffect(() => {
    const c = data.chart;
    if (candleRef.current) {
      candleRef.current.setData(
        toCandleData(c.dates, c.open, c.high, c.low, c.close),
      );
    }
    const RSI_KEYS = ['rsi_wilder', 'rsi_cutler', 'rsi_ema'] as const;
    rsiRefs.current.forEach((s: ISeriesApi<'Line'>, i: number) => {
      s.setData(toLineData(c.dates, c[RSI_KEYS[i]]));
    });
    maRefs.current.forEach((s: ISeriesApi<'Line'>, period: string) => {
      s.setData(toLineData(c.dates, c.ma[period] ?? []));
    });
  }, [data]);

  return (
    <div className="flex flex-col gap-1">
      {/* 패인 레이블 */}
      <div className="relative">
        <span className="absolute top-1 left-2 z-10 text-xs text-gray-500 pointer-events-none">
          가격 · MA · RSI 타겟
        </span>
        <LWChart height={PANE1_H} onChartReady={onChart1Ready} />
      </div>
      <div className="relative">
        <span className="absolute top-1 left-2 z-10 text-xs text-gray-500 pointer-events-none">
          RSI({data.period_rsi})
        </span>
        <LWChart
          height={PANE2_H}
          onChartReady={onChart2Ready}
          options={{ timeScale: { visible: true } }}
        />
      </div>
    </div>
  );
}
