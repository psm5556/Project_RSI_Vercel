'use client';

import { useState } from 'react';
import type { AnalysisData, TableRow } from '@/lib/types';

function fmtPrice(v: number | null) {
  if (v == null) return null;
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 10)   return v.toFixed(2);
  return v.toPrecision(5);
}

function Table({ rows, curRsi }: { rows: TableRow[]; curRsi: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-app-border">
            {['타겟 RSI', '예상 가격', '등락률', '방향'].map(h => (
              <th key={h} className="text-left py-2 px-3 text-xs text-app-muted uppercase tracking-wide font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isCurrent = Math.abs(r.target_rsi - curRsi) < 1.5;
            const rowCls = isCurrent
              ? 'text-yellow-300 font-semibold'
              : r.target_rsi >= 70 ? 'text-red-300'
              : r.target_rsi <= 30 ? 'text-teal-300' : 'text-gray-300';

            return (
              <tr key={i} className="border-b border-app-border/40 hover:bg-white/[0.02] transition-colors">
                <td className={`py-2 px-3 ${rowCls}`}>{r.target_rsi.toFixed(2)}</td>
                <td className="py-2 px-3">
                  {r.price != null
                    ? <span className={rowCls}>{fmtPrice(r.price)}</span>
                    : <span className="text-app-muted">계산 불가</span>
                  }
                </td>
                <td className="py-2 px-3">
                  {r.change_pct != null
                    ? <span className={r.change_pct >= 0 ? 'text-red-300' : 'text-teal-300'}>
                        {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                      </span>
                    : <span className="text-app-muted">-</span>
                  }
                </td>
                <td className={`py-2 px-3 ${rowCls}`}>{r.direction}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { key: 'wilder' as const, label: '📊 Wilder (표준)' },
  { key: 'cutler' as const, label: '📊 Cutler (SMA)' },
  { key: 'ema'    as const, label: '📊 EMA RSI' },
];

export function RsiTables({ data }: { data: AnalysisData }) {
  const [active, setActive] = useState<'wilder' | 'cutler' | 'ema'>('wilder');

  const curRsiMap = { wilder: data.rsi.wilder, cutler: data.rsi.cutler, ema: data.rsi.ema };

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-white mb-3">📋 타겟 RSI별 예상 가격</h3>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-app-border mb-3">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              active === t.key
                ? 'border-app-accent text-app-accent'
                : 'border-transparent text-app-muted hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
        <Table rows={data.tables[active]} curRsi={curRsiMap[active]} />
      </div>
    </div>
  );
}
