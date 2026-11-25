import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { CONSTITUTIONS, ORGANS, TYPE_KEYS, type OrganKey, type TypeKey } from '../data/constitutions'

/** 1080×1920 고정 캔버스를 화면 크기에 맞게 스케일 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1080, window.innerHeight / 1920))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function TopBar({ sessionId }: { sessionId?: string }) {
  const now = useClock()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">四</div>
        <div>
          <div className="brand-name">사상체질 형상분석</div>
          <div className="brand-sub">SASANG · HYEONGSANG ANALYSIS</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="num">
          {now.getFullYear()}.{pad(now.getMonth() + 1)}.{pad(now.getDate())} {pad(now.getHours())}:{pad(now.getMinutes())}
        </div>
        <div className="mono">{sessionId ?? 'STANDBY'}</div>
      </div>
    </header>
  )
}

export const STEP_NAMES = ['동의', '기본정보', '안면 형상', '체질 설문', '결과']

export function Steps({ current, progress = 1 }: { current: number; progress?: number }) {
  return (
    <div className="steps">
      {STEP_NAMES.map((n, i) => (
        <div key={n} className={`step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
          <div className="step-bar">
            <i style={{ width: i < current ? '100%' : i === current ? `${Math.max(8, progress * 100)}%` : '0%' }} />
          </div>
          <div className="step-label">
            {String(i + 1).padStart(2, '0')} {n}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FooterNote() {
  return (
    <div className="footer-note">
      본 서비스는 사상의학·형상의학 이론에 기반한 <b>건강 참고 정보</b>이며 의학적 진단을 대체하지 않습니다.
      <br />
      촬영 영상은 기기 내에서만 분석되며 저장·전송되지 않습니다.
    </div>
  )
}

/** 사상(四象) 나침반 문양 — 대기화면/결과 인장 */
export function SasangOrb({ size = 760, highlight }: { size?: number; highlight?: TypeKey }) {
  const c = size / 2
  const r1 = c - 8
  const r2 = c * 0.78
  const r3 = c * 0.5
  const quads: { k: TypeKey; a0: number }[] = [
    { k: 'taeyang', a0: -90 },
    { k: 'soyang', a0: 0 },
    { k: 'taeeum', a0: 90 },
    { k: 'soeum', a0: 180 },
  ]
  const arc = (r: number, a0: number, a1: number) => {
    const p = (a: number) => [c + r * Math.cos((a * Math.PI) / 180), c + r * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
  }
  const ticks = Array.from({ length: 72 })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="orbGlow">
          <stop offset="0%" stopColor="#5fb39a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#5fb39a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={r1} fill="url(#orbGlow)" />
      <g className="spin-slow">
        <circle cx={c} cy={c} r={r1} fill="none" stroke="rgba(214,200,168,0.25)" />
        {ticks.map((_, i) => {
          const a = (i * 5 * Math.PI) / 180
          const long = i % 6 === 0
          const ri = r1 - (long ? 26 : 12)
          return (
            <line key={i} x1={c + ri * Math.cos(a)} y1={c + ri * Math.sin(a)} x2={c + r1 * Math.cos(a)} y2={c + r1 * Math.sin(a)}
              stroke={long ? '#cfaa62' : 'rgba(214,200,168,0.3)'} strokeWidth={long ? 2 : 1} />
          )
        })}
      </g>
      <g className="spin-rev">
        <circle cx={c} cy={c} r={r2} fill="none" stroke="rgba(214,200,168,0.18)" strokeDasharray="2 10" />
      </g>
      {quads.map(({ k, a0 }) => {
        const col = CONSTITUTIONS[k].color
        const on = !highlight || highlight === k
        return (
          <g key={k} opacity={on ? 1 : 0.25}>
            <path d={arc(r2 - 24, a0 + 6, a0 + 84)} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />
          </g>
        )
      })}
      {quads.map(({ k, a0 }) => {
        const a = ((a0 + 45) * Math.PI) / 180
        const rr = (r2 + r3) / 2 - 18
        const on = !highlight || highlight === k
        return (
          <text key={k} x={c + rr * Math.cos(a)} y={c + rr * Math.sin(a)} textAnchor="middle" dominantBaseline="central"
            fontFamily="Noto Serif KR" fontWeight={700} fontSize={size * 0.06} fill={on ? CONSTITUTIONS[k].color : 'rgba(239,232,218,0.2)'}>
            {CONSTITUTIONS[k].hanja.slice(0, 2)}
          </text>
        )
      })}
      <circle cx={c} cy={c} r={r3 - 30} fill="rgba(10,16,15,0.85)" stroke="#cfaa62" strokeWidth={1.5} />
      <line x1={c - r3 + 30} y1={c} x2={c + r3 - 30} y2={c} stroke="rgba(207,170,98,0.4)" />
      <line x1={c} y1={c - r3 + 30} x2={c} y2={c + r3 - 30} stroke="rgba(207,170,98,0.4)" />
      <text x={c} y={c - size * 0.025} textAnchor="middle" fontFamily="Noto Serif KR" fontWeight={700} fontSize={size * 0.085} fill="#e9cf93">四象</text>
      <text x={c} y={c + size * 0.07} textAnchor="middle" fontFamily="Noto Serif KR" fontSize={size * 0.032} fill="#b9b2a3" letterSpacing={size * 0.01}>形象分析</text>
    </svg>
  )
}

/** 장부 대소 레이더 (폐·비·간·신) */
export function OrganRadar({ values, color, size = 420 }: { values: Record<OrganKey, number>; color: string; size?: number }) {
  const c = size / 2
  const R = c - 64
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / ORGANS.length
  const pt = (i: number, v: number) => [c + R * (v / 100) * Math.cos(angle(i)), c + R * (v / 100) * Math.sin(angle(i))]
  const poly = ORGANS.map((o, i) => pt(i, values[o.key]).join(',')).join(' ')
  return (
    <svg width={size} height={size}>
      {[25, 50, 75, 100].map((lv) => (
        <polygon key={lv} points={ORGANS.map((_, i) => pt(i, lv).join(',')).join(' ')} fill="none"
          stroke={lv === 50 ? 'rgba(207,170,98,0.45)' : 'rgba(214,200,168,0.14)'} strokeDasharray={lv === 50 ? '4 6' : undefined} />
      ))}
      {ORGANS.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(214,200,168,0.14)" />
      })}
      <polygon points={poly} fill={color + '40'} stroke={color} strokeWidth={3} />
      {ORGANS.map((o, i) => {
        const [x, y] = pt(i, values[o.key])
        const [lx, ly] = pt(i, 128)
        return (
          <g key={o.key}>
            <circle cx={x} cy={y} r={7} fill={color} stroke="#0a100f" strokeWidth={3} />
            <text x={lx} y={ly - 8} textAnchor="middle" fontSize={30} fontFamily="Noto Serif KR" fontWeight={700} fill="#efe8da">{o.hanja}</text>
            <text x={lx} y={ly + 22} textAnchor="middle" fontSize={18} fill="#7d796f" className="num">{o.name} {values[o.key]}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function TypeLegendDot({ k }: { k: TypeKey }) {
  return <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: CONSTITUTIONS[k].color, marginRight: 10 }} />
}

export { TYPE_KEYS }

export const Icon = {
  check: (s = 28) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  camera: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
  ),
  shield: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  info: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
  ),
  clock: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  arrow: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  back: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
  ),
  touch: (s = 40) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11V5.5a1.5 1.5 0 013 0V10m0 0V8.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v4.5A6.5 6.5 0 0111.5 21H11a6 6 0 01-4.6-2.2L3.8 15.6a1.6 1.6 0 012.4-2.1L9 16" /></svg>
  ),
}
