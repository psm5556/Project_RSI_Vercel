'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface PlotlyChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: Record<string, any>;
  height?: number;
}

export function PlotlyChart({ data, layout, height = 500 }: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('plotly.js-dist-min').then((Plotly: any) => {
      Plotly.react(el, data, { ...layout, height }, {
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      });
    });
  }, [data, layout, height]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import('plotly.js-dist-min').then((Plotly: any) => {
        Plotly.Plots.resize(el);
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ width: '100%', minHeight: height }}
      className="w-full"
    />
  );
}
