import type { AnalysisData, TrendData, LensData, Settings } from './types';

export async function fetchAnalysis(s: Settings): Promise<AnalysisData> {
  const url = `/api/analyze?ticker=${encodeURIComponent(s.ticker)}&period=${s.period}&interval=${s.interval}&lookback=${s.lookback}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as AnalysisData;
}

export async function fetchTrend(ticker: string): Promise<TrendData> {
  const res = await fetch(`/api/trend?ticker=${encodeURIComponent(ticker)}&lookback=5y`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as TrendData;
}

export async function fetchLens(ticker: string): Promise<LensData> {
  const res = await fetch(`/api/lens?ticker=${encodeURIComponent(ticker)}&lookback=2y`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as LensData;
}

export async function fetchSheetTickers(): Promise<{ ticker: string; name: string }[]> {
  try {
    const res = await fetch('/api/sheets');
    const data = await res.json();
    return Array.isArray(data.tickers) ? data.tickers : [];
  } catch {
    return [];
  }
}
