'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, DeepPartial, ChartOptions } from 'lightweight-charts';

export interface LWChartProps {
  height: number;
  options?: DeepPartial<ChartOptions>;
  onChartReady: (chart: IChartApi) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** 다크 테마 기본값 */
const DARK_DEFAULTS: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: '#0d1117' },
    textColor: '#e0e0e0',
  },
  grid: {
    vertLines: { color: '#1e2535' },
    horzLines: { color: '#1e2535' },
  },
  rightPriceScale: {
    borderColor: '#1e2535',
  },
  timeScale: {
    borderColor: '#1e2535',
    timeVisible: true,
    secondsVisible: false,
  },
  crosshair: {
    vertLine: { color: '#6b7280', labelBackgroundColor: '#1e2535' },
    horzLine: { color: '#6b7280', labelBackgroundColor: '#1e2535' },
  },
};

function mergeDeep<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override as object)) {
    const ov = (override as Record<string, unknown>)[key];
    const bv = (base as Record<string, unknown>)[key];
    if (ov !== null && typeof ov === 'object' && !Array.isArray(ov) && bv && typeof bv === 'object') {
      result[key] = mergeDeep(bv as object, ov as DeepPartial<object>);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}

/**
 * 단일 TradingView Lightweight Charts 패인 래퍼.
 * onChartReady 콜백으로 IChartApi를 전달받아 부모에서 시리즈를 추가합니다.
 */
export function LWChart({ height, options, onChartReady, className, style }: LWChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  // onChartReady를 ref로 캡처해 effect 재실행 방지
  const readyRef = useRef(onChartReady);
  readyRef.current = onChartReady;

  // ── 차트 마운트 / 언마운트 ────────────────────────────────────────��─────────
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    import('lightweight-charts').then(({ createChart, CrosshairMode }) => {
      if (!el) return; // unmounted before import resolved

      const merged = mergeDeep(DARK_DEFAULTS, options);
      const chart = createChart(el, {
        ...merged,
        width: el.clientWidth,
        height,
        crosshair: {
          ...(merged.crosshair ?? {}),
          mode: CrosshairMode.Normal,
        },
      });

      chartRef.current = chart;
      readyRef.current(chart);
    });

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
    // options은 초기 마운트 시에만 적용 (변경 시 applyOptions는 부모 담당)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // ── 너비 반응형 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      chartRef.current?.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height, ...style }}
    />
  );
}
