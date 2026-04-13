# Streamlit → Vercel 마이그레이션 프롬프트 템플릿

아래 프롬프트를 Claude에게 붙여넣어 다른 Streamlit 앱을 Vercel로 전환할 수 있습니다.
대괄호 `[...]` 부분만 실제 앱에 맞게 수정하세요.

---

## 사용법

1. 대상 Git 저장소를 로컬에 클론
2. Claude Code에서 해당 디렉토리 열기
3. 아래 프롬프트 전체를 복사해서 붙여넣기
4. `[...]` 항목만 실제 앱 내용으로 수정

---

## 프롬프트 본문 (여기서부터 복사)

---

현재 Streamlit으로 구현된 앱을 Vercel에서 동작하는 Next.js + React SPA로 완전히 재구성해주세요.
Streamlit 코드는 모두 제거하고 아래 사양을 따라 구현합니다.

## 앱 개요

- **앱 이름**: [앱 이름]
- **기능 요약**: [앱이 하는 일을 2~3줄로 설명]
- **현재 파일 구조**: [기존 Streamlit 파일 목록, 예: app.py, utils.py, requirements.txt]
- **백엔드 의존성**: [예: yfinance, pandas, numpy, ta, gspread 등]
- **주요 화면 구성**: [Streamlit의 각 섹션/탭/컨테이너를 설명]

---

## 1. 전체 아키텍처

```
[프로젝트 루트]/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃 (다크 테마, metadata)
│   ├── page.tsx            # 메인 페이지 (상태 관리, 레이아웃)
│   └── globals.css         # Tailwind + CSS 변수
├── components/
│   ├── Sidebar.tsx         # 좌측 입력 패널 (토글 가능)
│   ├── [컴포넌트명].tsx    # 주요 결과 표시 컴포넌트들
│   └── charts/
│       ├── LWChart.tsx     # TradingView LWC 래퍼 (주식 차트용)
│       └── [차트명].tsx    # 개별 차트 컴포넌트
├── lib/
│   ├── api.ts              # 프론트엔드 → API 호출 함수들
│   ├── types.ts            # TypeScript 인터페이스
│   ├── chartUtils.ts       # LWC 데이터 변환 헬퍼 (주식 차트용)
│   └── useChartSync.ts     # 다중 차트 시간축 동기화 훅
├── api/                    # Python 서버리스 함수 (Vercel)
│   ├── [엔드포인트].py
│   └── requirements.txt
├── package.json
├── vercel.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 2. Vercel 배포 설정

**vercel.json** — Next.js + Python 서버리스 혼합 구성:

```json
{
  "version": 2,
  "builds": [
    { "src": "package.json", "use": "@vercel/next" },
    { "src": "api/[엔드포인트1].py", "use": "@vercel/python" },
    { "src": "api/[엔드포인트2].py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/api/[엔드포인트1]", "dest": "/api/[엔드포인트1].py" },
    { "src": "/api/[엔드포인트2]", "dest": "/api/[엔드포인트2].py" }
  ]
}
```

> **주의**: 루트에 `app.py`, `main.py`, `server.py` 등이 있으면 Vercel이 Python 웹앱으로 감지합니다.
> 기존 Streamlit 파일은 `_archive/` 폴더로 이동하거나 삭제하세요.

**api/requirements.txt** — Python 서버리스용:
```
[pandas, numpy, yfinance 등 필요한 패키지]
```

---

## 3. Python 서버리스 API 변환 규칙

기존 Streamlit 함수 → Python HTTP 핸들러로 변환합니다.

```python
# api/[엔드포인트].py
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 쿼리 파라미터 파싱
        qs = parse_qs(urlparse(self.path).query)
        ticker = qs.get('ticker', [''])[0]
        
        try:
            # 기존 계산 로직 (Streamlit 의존성 제거 후 그대로 사용)
            result = compute(ticker)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def log_message(self, format, *args):
        pass  # Vercel 로그 억제
```

**변환 규칙:**
- `st.session_state` → React `useState`
- `st.sidebar.*` → `<Sidebar>` 컴포넌트
- `st.plotly_chart()` → LWC 차트 컴포넌트 (주식 차트) 또는 기타 React 차트
- `st.dataframe()` → HTML `<table>` 또는 커스텀 테이블 컴포넌트
- `st.columns()` → Tailwind CSS grid/flex
- `st.expander()` → `<Accordion>` 컴포넌트
- `st.metric()` → 커스텀 메트릭 카드 컴포넌트
- `st.spinner()` → 인라인 스피너 (로딩 상태)
- `@st.cache_data` → 해당 없음 (Vercel 서버리스는 무상태; 필요시 SWR/React Query 캐시)

---

## 4. Next.js 프로젝트 설정

**package.json**:
```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lightweight-charts": "^4.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

> `lightweight-charts`는 주식/금융 차트가 있을 때만 포함. 일반 차트라면 recharts, chart.js 등을 사용.

**tailwind.config.ts**:
```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg':      'var(--app-bg)',
        'app-surface': 'var(--app-surface)',
        'app-sidebar': 'var(--app-sidebar)',
        'app-card':    'var(--app-card)',
        'app-border':  'var(--app-border)',
        'app-muted':   'var(--app-muted)',
        'app-accent':  'var(--app-accent)',
      },
    },
  },
} satisfies Config;
```

**app/globals.css**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

:root {
  --app-bg:      #000000;
  --app-surface: #0d1117;
  --app-sidebar: #0a0a0a;
  --app-card:    #111827;
  --app-border:  #1e2535;
  --app-muted:   #6b7280;
  --app-accent:  #3b82f6;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a3044; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3a4054; }
```

---

## 5. 레이아웃 패턴 (app/layout.tsx + app/page.tsx)

**app/layout.tsx**:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '[앱 제목]',
  description: '[설명]',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-app-bg text-gray-200 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
```

**app/page.tsx** — 기본 구조:
```tsx
'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState({ /* 기본값 */ });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetch(`/api/[엔드포인트]?param=${settings.param}`).then(r => r.json());
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg">
      <Sidebar settings={settings} loading={loading} open={sidebarOpen} onChange={patch => setSettings(s => ({...s, ...patch}))} onRun={run} />

      <main className="flex-1 overflow-y-auto p-6 pt-12 relative">
        {/* 사이드바 토글 버튼 — 항상 좌상단 고정 */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="fixed top-3 left-3 z-50 w-7 h-7 flex items-center justify-center rounded-md bg-app-card border border-app-border text-app-muted hover:text-white hover:border-app-accent transition-all text-xs"
          title={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        {loading && <Spinner />}
        {error && <ErrorBox message={error} />}
        {!result && !loading && !error && <EmptyState />}
        {result && !loading && (
          <>
            {/* 결과 컴포넌트들 */}
          </>
        )}
      </main>
    </div>
  );
}
```

---

## 6. Sidebar 컴포넌트 패턴

```tsx
'use client';

interface Props {
  settings: Settings;
  loading: boolean;
  open: boolean;
  onChange: (s: Partial<Settings>) => void;
  onRun: () => void;
}

export function Sidebar({ settings, loading, open, onChange, onRun }: Props) {
  return (
    <aside
      className={`bg-app-sidebar border-r border-app-border flex flex-col gap-4 overflow-y-auto transition-all duration-300 ease-in-out ${
        open ? 'w-[280px] min-w-[280px] p-4 opacity-100' : 'w-0 min-w-0 p-0 opacity-0 pointer-events-none'
      }`}
    >
      {/* 제목 */}
      <div>
        <div className="text-base font-bold text-white">[앱 아이콘] [앱 제목]</div>
        <div className="text-xs text-app-muted mt-1">[간단한 설명]</div>
      </div>

      <hr className="border-app-border" />

      {/* 입력 필드들 */}
      {/* ... */}

      {/* 실행 버튼 */}
      <button
        onClick={onRun}
        disabled={loading}
        className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors"
      >
        {loading ? '로딩 중…' : '[실행 버튼 레이블]'}
      </button>
    </aside>
  );
}
```

---

## 7. 주식/금융 차트 (TradingView Lightweight Charts)

주식 차트가 포함된 경우 Plotly 대신 TradingView Lightweight Charts를 사용합니다.

**장점**: 번들 ~50KB (Plotly 대비 60배 가벼움), Canvas 기반 고성능, 주식 특화 API

**LWChart.tsx** — 단일 패인 래퍼:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import type { IChartApi, DeepPartial, ChartOptions } from 'lightweight-charts';

const DARK_DEFAULTS: DeepPartial<ChartOptions> = {
  layout: { background: { color: '#0d1117' }, textColor: '#e0e0e0' },
  grid: { vertLines: { color: '#1e2535' }, horzLines: { color: '#1e2535' } },
  rightPriceScale: { borderColor: '#1e2535' },
  timeScale: { borderColor: '#1e2535', timeVisible: true, secondsVisible: false },
  crosshair: {
    vertLine: { color: '#6b7280', labelBackgroundColor: '#1e2535' },
    horzLine: { color: '#6b7280', labelBackgroundColor: '#1e2535' },
  },
};

export function LWChart({ height, options, onChartReady }: {
  height: number;
  options?: DeepPartial<ChartOptions>;
  onChartReady: (chart: IChartApi) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const readyRef = useRef(onChartReady);
  readyRef.current = onChartReady;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    import('lightweight-charts').then(({ createChart, CrosshairMode }) => {
      if (!el) return;
      const chart = createChart(el, { ...DARK_DEFAULTS, ...options, width: el.clientWidth, height, crosshair: { mode: CrosshairMode.Normal } });
      chartRef.current = chart;
      readyRef.current(chart);
    });
    return () => { chartRef.current?.remove(); chartRef.current = null; };
  }, [height]); // eslint-disable-line

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => chartRef.current?.applyOptions({ width: containerRef.current!.clientWidth }));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
```

**다중 패인 시간축 동기화** (lib/useChartSync.ts):
```ts
import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';

export function useChartSync(charts: (IChartApi | null)[]): void {
  useEffect(() => {
    const valid = charts.filter((c): c is IChartApi => c !== null);
    if (valid.length < 2) return;
    const unsubs: (() => void)[] = [];
    valid.forEach((source, i) => {
      const handler = (range: { from: number; to: number } | null) => {
        if (!range) return;
        valid.forEach((target, j) => { if (i !== j) target.timeScale().setVisibleLogicalRange(range); });
      };
      source.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubs.push(() => source.timeScale().unsubscribeVisibleLogicalRangeChange(handler));
    });
    return () => unsubs.forEach(fn => fn());
  }, [charts]); // eslint-disable-line
}
```

**null 처리**: LWC는 null 값에 `WhitespaceData({ time })` 사용 — 배열에서 null을 필터링하면 패인 간 시간축 불일치 발생.

**데이터 변환 헬퍼** (lib/chartUtils.ts):
```ts
export function toLineData(dates: string[], values: (number | null)[]) {
  return dates.map((d, i) => {
    const time = d.substring(0, 10) as Time;
    const v = values[i];
    return (v == null || !isFinite(v)) ? { time } : { time, value: v };
  });
}
// toCandleData, toHistogramData 등도 동일 패턴
```

**Supertrend 배경 밴드** (Plotly shapes 대체):
```ts
// CSS linear-gradient로 구현, LWC 컨테이너 div에 background로 적용
// LWC 차트 자체는 layout.background.color: 'transparent' 설정
```

---

## 8. 일반 UI 컴포넌트 패턴

**Accordion** (st.expander 대체):
```tsx
function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-app-border rounded-xl overflow-hidden mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-app-card hover:bg-gray-800/60 transition-colors text-left">
        <span className="font-medium text-gray-200">{title}</span>
        <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="p-4 bg-app-surface border-t border-app-border">{children}</div>}
    </div>
  );
}
```

**MetricCard** (st.metric 대체):
```tsx
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-app-card border border-app-border rounded-lg p-3">
      <div className="text-xs text-app-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="font-bold text-sm" style={{ color: color ?? '#fff' }}>{value}</div>
      {sub && <div className="text-xs text-app-muted mt-0.5">{sub}</div>}
    </div>
  );
}
```

**DataTable** (st.dataframe 대체):
```tsx
// 컬럼 정의 배열로 범용 테이블 구성
<div className="overflow-x-auto">
  <table className="w-full text-sm border-collapse">
    <thead><tr className="border-b border-app-border">...</tr></thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} className="border-b border-app-border/40 hover:bg-app-card/50">...</tr>
      ))}
    </tbody>
  </table>
</div>
```

**로딩 스피너**:
```tsx
function Spinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-app-muted mb-4">
      <span className="inline-block w-4 h-4 border-2 border-app-border border-t-app-accent rounded-full animate-spin" />
      로딩 중…
    </div>
  );
}
```

---

## 9. 자주 나오는 Streamlit 패턴 → React 변환표

| Streamlit | React/Next.js |
|-----------|--------------|
| `st.title()`, `st.header()` | `<h1>`, `<h2>` with Tailwind |
| `st.text_input()` | `<input className="...">` |
| `st.selectbox()` | `<select>` |
| `st.number_input()` | `<input type="number">` |
| `st.button()` | `<button onClick={...}>` |
| `st.checkbox()` | `<input type="checkbox">` |
| `st.slider()` | `<input type="range">` |
| `st.columns(n)` | `<div className="grid grid-cols-n gap-4">` |
| `st.tabs()` | 탭 컴포넌트 또는 Accordion |
| `st.expander()` | `<Accordion>` |
| `st.metric()` | `<MetricCard>` |
| `st.dataframe()` | `<table>` |
| `st.plotly_chart()` | LWC 컴포넌트 (주식) 또는 Recharts |
| `st.success()` | `<div className="text-green-400 ...">` |
| `st.error()` | `<div className="text-red-400 ...">` |
| `st.warning()` | `<div className="text-yellow-400 ...">` |
| `st.info()` | `<div className="text-blue-400 ...">` |
| `st.spinner()` | `{loading && <Spinner />}` |
| `st.session_state` | `useState` |
| `st.rerun()` | `useEffect` + 상태 업데이트 |
| `@st.cache_data` | SWR / React Query / useMemo |
| `st.sidebar` | `<Sidebar open={...}>` |

---

## 10. 구현 순서

1. 기존 Streamlit 파일을 읽고 기능/데이터 구조 파악
2. `lib/types.ts` — TypeScript 인터페이스 정의
3. `api/*.py` — Python 로직을 서버리스 핸들러로 변환
4. `api/requirements.txt` — Python 의존성
5. `vercel.json` — 빌드 + 라우트 설정
6. `package.json`, `tailwind.config.ts`, `tsconfig.json`, `next.config.ts` 생성
7. `app/globals.css`, `app/layout.tsx` 생성
8. `lib/api.ts` — API 호출 함수
9. `components/Sidebar.tsx` — 입력 패널
10. 각 결과 컴포넌트 구현
11. `app/page.tsx` — 전체 조합
12. 기존 Streamlit 파일을 `_archive/`로 이동 (루트에 app.py 등 남기지 않음)
13. `npm install && npm run build`로 빌드 확인
14. `git commit && git push`

---

## 11. 체크리스트

- [ ] 루트에 `app.py`, `main.py`, `server.py`, `index.py` 없음 (있으면 `_archive/`로 이동)
- [ ] `vercel.json`에 모든 Python 엔드포인트 명시
- [ ] `api/requirements.txt` 존재
- [ ] `npm run build` 빌드 오류 없음
- [ ] TypeScript `any` 타입 없음 (strict 모드)
- [ ] 사이드바 토글 버튼 (`◀/▶`) 좌상단 고정
- [ ] 다크 테마 일관성 (`--app-*` CSS 변수 사용)
- [ ] API 에러 시 사용자에게 에러 메시지 표시
- [ ] 로딩 상태 표시

---

*이 프롬프트는 psm55/Project_RSI_Vercel 마이그레이션에서 추출된 패턴입니다.*
