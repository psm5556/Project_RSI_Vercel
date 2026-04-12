'use client';

import { useEffect, useState } from 'react';
import { fetchSheetTickers } from '@/lib/api';
import type { Settings } from '@/lib/types';

const PRESETS = [
  { label: 'S&P 500',   sym: '^GSPC' },
  { label: '나스닥100', sym: '^NDX'  },
  { label: '나스닥',    sym: '^IXIC' },
  { label: '코스피',    sym: '^KS11' },
  { label: '코스닥',    sym: '^KQ11' },
  { label: '다우',      sym: '^DJI'  },
];

const INTERVALS = [
  { label: '주봉', val: '1wk' }, { label: '일봉', val: '1d' },
  { label: '월봉', val: '1mo' }, { label: '1시간', val: '1h' },
  { label: '4시간', val: '4h' }, { label: '15분',  val: '15m' },
];

const LOOKBACKS = [
  { label: '3개월', val: '3mo' }, { label: '6개월', val: '6mo' },
  { label: '1년',   val: '1y'  }, { label: '2년',   val: '2y'  },
  { label: '5년',   val: '5y'  }, { label: '10년',  val: '10y' },
  { label: '15년',  val: '15y' },
];

interface Props {
  settings: Settings;
  loading: boolean;
  open: boolean;
  onChange: (s: Partial<Settings>) => void;
  onRun: () => void;
}

export function Sidebar({ settings, loading, open, onChange, onRun }: Props) {
  const [sheetTickers, setSheetTickers] = useState<{ ticker: string; name: string }[]>([]);

  useEffect(() => {
    fetchSheetTickers().then(setSheetTickers);
  }, []);

  return (
    <aside
      className={`bg-app-sidebar border-r border-app-border flex flex-col gap-4 overflow-y-auto transition-all duration-300 ease-in-out ${
        open ? 'w-[280px] min-w-[280px] p-4 opacity-100' : 'w-0 min-w-0 p-0 opacity-0 pointer-events-none'
      }`}
    >
      {/* Title */}
      <div>
        <div className="text-base font-bold text-white">📈 RSI 타겟 가격 계산기</div>
        <div className="text-xs text-app-muted mt-1 leading-relaxed">
          RSI 타겟 달성에 필요한 가격을 계산합니다.
        </div>
      </div>

      <hr className="border-app-border" />

      {/* Preset buttons */}
      <div>
        <div className="text-xs text-app-muted uppercase tracking-wide mb-2">주요 지수</div>
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map(p => (
            <button
              key={p.sym}
              onClick={() => { onChange({ ticker: p.sym }); }}
              className={`text-xs px-2 py-1.5 rounded-md border transition-all truncate ${
                settings.ticker === p.sym
                  ? 'bg-blue-900/40 border-app-accent text-app-accent'
                  : 'bg-gray-900 border-app-border text-gray-300 hover:border-app-accent hover:text-app-accent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-app-border" />

      {/* Sheet tickers */}
      {sheetTickers.length > 0 && (
        <div>
          <div className="text-xs text-app-muted uppercase tracking-wide mb-2">구글시트 종목</div>
          <div className="flex gap-1.5">
            <select
              className="flex-1 bg-app-card border border-app-border text-gray-200 text-sm px-2.5 py-1.5 rounded-md focus:border-app-accent outline-none"
              defaultValue=""
              onChange={e => { if (e.target.value) onChange({ ticker: e.target.value }); }}
            >
              <option value="">— 선택 —</option>
              {sheetTickers.map(t => (
                <option key={t.ticker} value={t.ticker}>{t.name}  ({t.ticker})</option>
              ))}
            </select>
            <button
              onClick={() => fetchSheetTickers().then(setSheetTickers)}
              className="px-2.5 py-1.5 bg-gray-900 border border-app-border text-app-muted rounded-md hover:border-app-accent hover:text-app-accent text-sm"
              title="새로고침"
            >↻</button>
          </div>
        </div>
      )}

      <hr className="border-app-border" />

      {/* Direct input */}
      <div>
        <label className="block text-xs text-app-muted mb-1.5">심볼 직접 입력</label>
        <input
          type="text"
          value={settings.ticker}
          onChange={e => onChange({ ticker: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') onRun(); }}
          placeholder="AAPL, TSLA, ^GSPC, 005930 …"
          className="w-full bg-app-card border border-app-border text-gray-200 text-sm px-3 py-2 rounded-md focus:border-app-accent outline-none"
        />
      </div>

      {/* RSI Period */}
      <div>
        <label className="block text-xs text-app-muted mb-1.5">RSI 기간 (봉 수)</label>
        <input
          type="number"
          value={settings.period}
          min={2} max={50}
          onChange={e => onChange({ period: parseInt(e.target.value) || 14 })}
          className="w-full bg-app-card border border-app-border text-gray-200 text-sm px-3 py-2 rounded-md focus:border-app-accent outline-none"
        />
      </div>

      {/* Interval */}
      <div>
        <label className="block text-xs text-app-muted mb-1.5">차트 간격</label>
        <select
          value={settings.interval}
          onChange={e => onChange({ interval: e.target.value })}
          className="w-full bg-app-card border border-app-border text-gray-200 text-sm px-3 py-2 rounded-md focus:border-app-accent outline-none"
        >
          {INTERVALS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      {/* Lookback */}
      <div>
        <label className="block text-xs text-app-muted mb-1.5">조회 기간</label>
        <select
          value={settings.lookback}
          onChange={e => onChange({ lookback: e.target.value })}
          className="w-full bg-app-card border border-app-border text-gray-200 text-sm px-3 py-2 rounded-md focus:border-app-accent outline-none"
        >
          {LOOKBACKS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={loading}
        className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors mt-1"
      >
        {loading ? '로딩 중…' : '계산하기'}
      </button>
    </aside>
  );
}
