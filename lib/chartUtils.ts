import type {
  CandlestickData,
  LineData,
  HistogramData,
  WhitespaceData,
  Time,
} from 'lightweight-charts';

// ── 날짜 변환 ─────────────────────────────────────────────────────────────────
/** ISO 문자열 → 'YYYY-MM-DD' (timezone 이슈 없이 substring 사용) */
export function isoToDay(iso: string): string {
  return iso.substring(0, 10);
}

// ── 데이터 변환 ───────────────────────────────────────────────────────────────

/** 날짜 + 값 배열 → LWC LineData | WhitespaceData (null은 WhitespaceData로 갭 유지) */
export function toLineData(
  dates: string[],
  values: (number | null)[],
): (LineData<Time> | WhitespaceData<Time>)[] {
  return dates.map((d, i) => {
    const time = isoToDay(d) as Time;
    const v = values[i];
    if (v == null || !isFinite(v)) return { time } as WhitespaceData<Time>;
    return { time, value: v } as LineData<Time>;
  });
}

/** OHLC 배열 → LWC CandlestickData | WhitespaceData */
export function toCandleData(
  dates: string[],
  open: (number | null)[],
  high: (number | null)[],
  low: (number | null)[],
  close: (number | null)[],
): (CandlestickData<Time> | WhitespaceData<Time>)[] {
  return dates.map((d, i) => {
    const time = isoToDay(d) as Time;
    const o = open[i], h = high[i], l = low[i], c = close[i];
    if (o == null || h == null || l == null || c == null) {
      return { time } as WhitespaceData<Time>;
    }
    return { time, open: o, high: h, low: l, close: c } as CandlestickData<Time>;
  });
}

/** 히스토그램 데이터 (MACD, CCI) — 값별 color 함수 포함 */
export function toHistogramData(
  dates: string[],
  values: (number | null)[],
  colorFn: (v: number) => string,
): (HistogramData<Time> | WhitespaceData<Time>)[] {
  return dates.map((d, i) => {
    const time = isoToDay(d) as Time;
    const v = values[i];
    if (v == null || !isFinite(v)) return { time } as WhitespaceData<Time>;
    return { time, value: v, color: colorFn(v) } as HistogramData<Time>;
  });
}

// ── 색상 ──────────────────────────────────────────────────────────────────────

export const MA_COLORS: Record<string, string> = {
  '20':  '#ff4444',
  '60':  '#00cc44',
  '125': '#3399ff',
  '200': '#ffee00',
  '240': '#ff8800',
  '365': '#cccccc',
};

/** RSI 타겟 수평선 색상 */
export function colorForRsi(rsi: number): string {
  if (rsi >= 70) return '#ef9a9a';
  if (rsi <= 30) return '#4fc3f7';
  return '#bdbdbd';
}

/** MACD/CCI 히스토그램 기본 색상 */
export const macdColor = (v: number) => (v >= 0 ? '#26a69a' : '#ef5350');

// ── 가격 포맷 ─────────────────────────────────────────────────────────────────
export function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 10)   return v.toFixed(2);
  return v.toPrecision(5);
}

// ── Supertrend 배경 밴드 (CSS gradient) ──────────────────────────────────────
/**
 * is_up 배열로부터 CSS linear-gradient 문자열 생성.
 * 패인 컨테이너 div의 background 스타일로 사용.
 */
export function buildGradientStyle(isUp: boolean[]): string {
  if (!isUp.length) return 'transparent';
  const stops: string[] = [];
  let i = 0;
  while (i < isUp.length) {
    let j = i + 1;
    while (j < isUp.length && isUp[j] === isUp[i]) j++;
    const x0 = ((i / isUp.length) * 100).toFixed(2);
    const x1 = ((j / isUp.length) * 100).toFixed(2);
    const clr = isUp[i] ? 'rgba(0,160,0,.10)' : 'rgba(200,0,0,.10)';
    stops.push(`${clr} ${x0}%`, `${clr} ${x1}%`);
    i = j;
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
