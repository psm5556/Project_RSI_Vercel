export interface RsiData {
  wilder: number;
  cutler: number;
  ema: number;
}

export interface TableRow {
  target_rsi: number;
  price: number | null;
  change_pct: number | null;
  direction: string;
}

export interface TargetLine {
  rsi: number;
  price: number | null;
  change_pct: number | null;
  is_fixed: boolean;
}

export interface ChartData {
  dates: string[];
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  rsi_wilder: (number | null)[];
  rsi_cutler: (number | null)[];
  rsi_ema: (number | null)[];
  ma: Record<string, (number | null)[]>;
  target_lines: TargetLine[];
}

export interface AnalysisData {
  ticker: string;
  resolved: string;
  current_price: number;
  date: string;
  interval: string;
  lookback: string;
  period_rsi: number;
  rsi: RsiData;
  tables: {
    wilder: TableRow[];
    cutler: TableRow[];
    ema: TableRow[];
  };
  chart: ChartData;
}

export interface Signal {
  date: string;
  price: number;
  side: 'UP' | 'DOWN' | 'BOTTOM';
  score?: number;
}

export interface TrendSummary {
  is_up: boolean;
  rsi: number;
  macd: number;
  macd_hist: number;
  vs_ma20: number | null;
  vs_ma60: number | null;
}

export interface TrendData {
  dates: string[];
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  supertrend: (number | null)[];
  is_up: boolean[];
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_hist: (number | null)[];
  rsi: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  signals: Signal[];
  summary: TrendSummary;
}

export interface LensData {
  dates: string[];
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  supertrend: (number | null)[];
  is_up: boolean[];
  rsi: (number | null)[];
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_hist: (number | null)[];
  bb_upper: (number | null)[];
  bb_lower: (number | null)[];
  bb_pct: (number | null)[];
  stoch_k: (number | null)[];
  stoch_d: (number | null)[];
  cci: (number | null)[];
  adx: (number | null)[];
  plus_di: (number | null)[];
  minus_di: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  score: (number | null)[];
  signals: Signal[];
}

export interface Settings {
  ticker: string;
  period: number;
  interval: string;
  lookback: string;
}
