'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MetricsGrid } from '@/components/MetricsGrid';
import { RsiTables } from '@/components/RsiTables';
import { MainChart } from '@/components/charts/MainChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { LensChart } from '@/components/charts/LensChart';
import { fetchAnalysis, fetchTrend, fetchLens } from '@/lib/api';
import type { AnalysisData, TrendData, LensData, Settings } from '@/lib/types';

const DEFAULT_SETTINGS: Settings = {
  ticker: '^GSPC',
  period: 14,
  interval: '1wk',
  lookback: '5y',
};

// ── Accordion ──────────────────────────────────────────────────────────────────
function Accordion({
  title, children, defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-app-border rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-app-card hover:bg-gray-800/60 transition-colors text-left"
      >
        <span className="font-medium text-gray-200">{title}</span>
        <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="p-4 bg-app-surface border-t border-app-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Formula explanation ────────────────────────────────────────────────────────
function FormulaContent({ period }: { period: number }) {
  return (
    <div className="text-sm text-gray-300 space-y-4">
      <div>
        <h4 className="font-semibold text-white mb-2">RSI 계산 방식 비교</h4>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-app-border">
              <th className="text-left py-2 px-3 text-app-muted font-normal">방식</th>
              <th className="text-left py-2 px-3 text-app-muted font-normal">평활화</th>
              <th className="text-left py-2 px-3 text-app-muted font-normal">alpha</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Wilder (표준)', 'EWM (adjust=False)', `α = 1/${period}`],
              ['Cutler (SMA)', '단순 이동평균', '—'],
              [`EMA RSI`, 'EWM (adjust=False)', `α = 2/${period + 1}`],
            ].map(([m, s, a]) => (
              <tr key={m} className="border-b border-app-border/40">
                <td className="py-2 px-3 font-medium text-white">{m}</td>
                <td className="py-2 px-3">{s}</td>
                <td className="py-2 px-3 font-mono">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="text-app-muted text-xs leading-relaxed">
          RSI = 100 − 100 / (1 + RS),  RS = Avg Gain / Avg Loss<br />
          <strong className="text-gray-300">타겟 가격 역산 (Wilder)</strong><br />
          RSₜ = target_RSI / (100 − target_RSI)<br />
          상승: P = P_cur + (n−1) × (RSₜ × avg_loss − avg_gain)<br />
          하락: P = P_cur + (n−1) × (avg_loss − avg_gain / RSₜ)
        </p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [trend, setTrend]       = useState<TrendData | null>(null);
  const [lens, setLens]         = useState<LensData | null>(null);

  const [loading, setLoading]         = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [lensLoading, setLensLoading]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTrend(null);
    setLens(null);

    try {
      const data = await fetchAnalysis(settings);
      setAnalysis(data);

      // Load secondary charts in parallel, non-blocking
      const resolved = data.resolved;

      setTrendLoading(true);
      fetchTrend(resolved)
        .then(setTrend)
        .catch(() => {})
        .finally(() => setTrendLoading(false));

      setLensLoading(true);
      fetchLens(resolved)
        .then(setLens)
        .catch(() => {})
        .finally(() => setLensLoading(false));

    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg">
      <Sidebar settings={settings} loading={loading} onChange={updateSettings} onRun={run} />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Status */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-app-muted mb-4">
            <span className="inline-block w-4 h-4 border-2 border-app-border border-t-app-accent rounded-full animate-spin" />
            {settings.ticker} 데이터 로딩 중…
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-900/20 border border-red-700/40 rounded-lg text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Empty state */}
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center text-app-muted">
            <div className="text-5xl mb-4">📈</div>
            <div className="text-lg font-medium text-gray-400 mb-2">RSI 타겟 가격 계산기</div>
            <div className="text-sm">좌측 사이드바에서 종목을 선택하고 계산하기를 누르세요.</div>
          </div>
        )}

        {/* Results */}
        {analysis && !loading && (
          <>
            <MetricsGrid data={analysis} />
            <RsiTables data={analysis} />

            {/* Main chart */}
            <div className="mb-5">
              <h3 className="text-base font-semibold text-white mb-3">📊 차트</h3>
              <div className="bg-app-surface border border-app-border rounded-xl p-1">
                <MainChart data={analysis} />
              </div>
            </div>

            {/* Trend Vision */}
            <Accordion title="📈 Trend Vision (주봉)">
              {trendLoading && <Loading />}
              {trend && <TrendChart data={trend} ticker={analysis.resolved} />}
            </Accordion>

            {/* Multi Lens */}
            <Accordion title="📉 Multi Lens (일봉)">
              {lensLoading && <Loading />}
              {lens && <LensChart data={lens} ticker={analysis.resolved} />}
            </Accordion>

            {/* Formula */}
            <Accordion title="📖 계산 방식 설명">
              <FormulaContent period={analysis.period_rsi} />
            </Accordion>
          </>
        )}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-app-muted py-4">
      <span className="inline-block w-4 h-4 border-2 border-app-border border-t-app-accent rounded-full animate-spin" />
      차트 생성 중…
    </div>
  );
}
