import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';

/**
 * 여러 LWC 차트 인스턴스의 시간축을 동기화합니다.
 * 한 차트의 visible range가 변경되면 나머지 차트에도 동일하게 적용.
 *
 * LWC의 setVisibleLogicalRange는 자체 subscriber를 트리거하지 않으므로
 * 무한 루프 없이 안전하게 동기화됩니다.
 */
export function useChartSync(charts: (IChartApi | null)[]): void {
  useEffect(() => {
    const valid = charts.filter((c): c is IChartApi => c !== null);
    if (valid.length < 2) return;

    const unsubs: (() => void)[] = [];

    valid.forEach((source, i) => {
      const handler = (range: { from: number; to: number } | null) => {
        if (!range) return;
        valid.forEach((target, j) => {
          if (i !== j) {
            target.timeScale().setVisibleLogicalRange(range);
          }
        });
      };

      source.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubs.push(() =>
        source.timeScale().unsubscribeVisibleLogicalRangeChange(handler),
      );
    });

    return () => unsubs.forEach(fn => fn());
  }, [charts]); // eslint-disable-line react-hooks/exhaustive-deps
}
