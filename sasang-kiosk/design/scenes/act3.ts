/**
 * 3막 형상 판독 — S06 조리개·정렬 · S07 조준 고정 · S08 빛의 주사 · S09 삼정 계측과 채록
 * 무대: 암실 한가운데 원형 렌즈(역광 한지). 카메라가 보는 관람자는 먹점 얼굴로 맺히고(B),
 * 스캔 평면이 지나간 자리부터 앰버 점구름으로 깨어난다(A). 청자 헤어라인·Plex Mono가 정밀함을,
 * 금 테·유리 반사·Cormorant 숫자가 결(C)을 맡는다. 빛이 선을 긋고, 먹은 번진다.
 */
import {
  C, FONT, H, W, blackout, brackets, clamp, clipCircle, ctx, disclaimer, ease, face, hair, hanji, layer, lerp, mono, rng, seg, setCtx, text, tmp, vignette,
  type Face, type Scene,
} from '../engine'

const ACT = '형상 판독'
/** 렌즈: S05에서 조리개가 닫힌 바로 그 중심 */
const LC = { x: 540, y: 760, r: 390 }
/** 72눈금 링 안쪽 반경 */
const RING = 398
/** 렌즈 속 얼굴 폭 */
const FW = 480
/** 장면 전역 시각 — 먼지·바늘 떨림이 컷에서 끊기지 않게 */
const T0 = { S06: 0, S07: 4, S08: 6.5, S09: 10 }
/** 렌즈 주변 작업 영역(부분 블러로 비용 절감) */
const BOX = { x: LC.x - 470, y: LC.y - 470, w: 940, h: 940 }
const FULL = { x: 0, y: 0, w: W, h: H }
/** 광심(카메라 자리의 빛점) */
const EYE = { x: 540, y: 246 }
/** 아래 띠: 계기·슬레이트·계수기·판독값이 차례로 놓이는 자리 */
const DIAL_Y = 1372
const GUIDE_Y = 1612
/** 왼쪽 계측 기둥 */
const SCALE_X = 128
/** 오른쪽 옆얼굴 윤곽 기준선 */
const PROF_X = 968

const getFace = () => face(LC.x, LC.y, FW)

/** 삼정 경계선: 발제(추정)·미간·비하·턱끝 */
function zones(f: Face) {
  const brow = f.lm[9].y, base = f.lm[2].y, chin = f.lm[152].y
  return { top: brow - (base - brow) * (0.27 / 0.33), brow, base, chin }
}
function faceBox(f: Face) {
  let x0 = 1e9, x1 = -1e9
  for (const p of f.lm) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x) }
  return { x0: x0 - 26, y0: f.lm[10].y - 30, x1: x1 + 26, y1: f.lm[152].y + 24 }
}

/* ───────── 그리기 보조 ───────── */
type Ctx = CanvasRenderingContext2D
/** ctx를 임시 레이어로 돌려 그린다 */
function off(fn: () => void, L: { c: HTMLCanvasElement; x: Ctx } = tmp()) {
  const m = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(m) }
  return L.c
}
/** 부분 영역만 (흐림을 걸어) 옮겨 그린다 */
function region(src: HTMLCanvasElement, b: { x: number; y: number; w: number; h: number }, blur = 0, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0.002) return
  const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y))
  const x1 = Math.min(W, Math.ceil(b.x + b.w)), y1 = Math.min(H, Math.ceil(b.y + b.h))
  if (x1 <= x0 || y1 <= y0) return
  ctx.save()
  ctx.globalAlpha = clamp(alpha)
  ctx.globalCompositeOperation = op
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}
function glow(src: HTMLCanvasElement, radii: number[], alphas: number[], b = FULL) {
  radii.forEach((r, i) => region(src, b, r, alphas[i], 'lighter'))
}
function camera(s: number, fn: () => void, px = LC.x, py = LC.y) {
  ctx.save()
  ctx.translate(px, py); ctx.scale(s, s); ctx.translate(-px, -py)
  fn()
  ctx.restore()
}
function lineA(x0: number, y0: number, x1: number, y1: number, color: string, w: number, alpha: number) {
  if (alpha > 0.003) hair(x0, y0, x1, y1, color, w, alpha)
}
/** 불꽃점(앰버) — sp 레이어에 쌓았다가 한 번에 블룸 */
function spark(sp: Ctx, x: number, y: number, r: number, a: number, col = '255,226,170') {
  if (a <= 0.01) return
  sp.fillStyle = `rgba(${col},${clamp(a)})`
  sp.beginPath(); sp.arc(x, y, r, 0, 6.283); sp.fill()
}
function flush(sp: { c: HTMLCanvasElement }, k = 1) {
  ctx.drawImage(sp.c, 0, 0)
  glow(sp.c, [4, 16], [0.85 * k, 0.5 * k])
}
/** 빛이 긋는 선: k 0→1, 머리에 불꽃 */
function lightLine(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w: number, alpha: number, sp?: Ctx) {
  if (k <= 0 || alpha <= 0) return
  const e = ease.out3(clamp(k))
  const xe = lerp(x0, x1, e), ye = lerp(y0, y1, e)
  lineA(x0, y0, xe, ye, color, w, alpha)
  if (sp && k < 1) spark(sp, xe, ye, 2.2, alpha * (1 - ease.sine(seg(k, 0.75, 1))))
}
/** 꺾인 지시선(점열을 따라 길이 비례로 그어짐) */
function polyLine(pts: [number, number][], k: number, color: string, w: number, alpha: number, sp?: Ctx) {
  if (k <= 0 || alpha <= 0) return
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const total = lens.reduce((a, b) => a + b, 0)
  let left = total * ease.inOut3(clamp(k))
  let hx = pts[0][0], hy = pts[0][1]
  for (let i = 0; i < lens.length && left > 0; i++) {
    const u = Math.min(1, left / lens[i])
    hx = lerp(pts[i][0], pts[i + 1][0], u); hy = lerp(pts[i][1], pts[i + 1][1], u)
    lineA(pts[i][0], pts[i][1], hx, hy, color, w, alpha)
    left -= lens[i]
  }
  if (sp && k < 1) spark(sp, hx, hy, 2.2, alpha)
}
function textW(s: string, font: string, spacing = 0) {
  ctx.save(); ctx.font = font; ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(s).width
  ctx.restore()
  return w
}
/** 새겨지는 수치: 흐림→선명, 앰버로 달궈졌다 식는다 */
function engrave(s: string, x: number, y: number, size: number, k: number, align: CanvasTextAlign = 'center', cool: string = C.hanji, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const e = ease.out3(clamp(k))
  const font = `300 ${size}px ${FONT.mono}`
  text(s, x, y, font, cool, { align, alpha: e * alpha, blur: (1 - e) * 8, spacing: size * 0.08 })
  const hot = (1 - ease.sine(seg(k, 0.35, 1))) * clamp(k * 5)
  if (hot > 0.01) text(s, x, y, font, C.amberCore, { align, alpha: hot * alpha, spacing: size * 0.08 })
}
/** 먹이 맺히듯 나타나는 한글 안내(흐림→선명) */
function guide(s: string, k: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const e = ease.sine(clamp(k))
  text(s, W / 2, GUIDE_Y, `300 46px ${FONT.hahmlet}`, C.hanji, { align: 'center', spacing: 3, alpha: e * alpha, blur: (1 - ease.out3(clamp(k))) * 10 })
}
/** 상단 크레딧(오른쪽 순번은 장면 시작에서 교차) */
function head(from: number, to: number, k: number, alpha = 1) {
  if (alpha <= 0) return
  mono('墨光判讀室 · INK-LIGHT READING ROOM', 72, 96, C.ash, 20, 'left', alpha)
  const s = (n: number) => `形象 · FACE READ  0${n} / 04`
  if (from !== to && k < 1) mono(s(from), W - 72, 96, C.ash, 20, 'right', alpha * (1 - k))
  mono(s(to), W - 72, 96, C.ash, 20, 'right', alpha * (from === to ? 1 : k))
  hair(72, 118, W - 72, 118, 'rgba(140,135,124,0.3)', 1, alpha)
}

/* ───────── 방·렌즈 ───────── */
/** 암실: 천장 광원의 잔광과 떠다니는 먼지(먼지는 sp로 블룸) */
function room(T: number, k: number, sp: Ctx) {
  if (k <= 0) return
  const g = ctx.createRadialGradient(EYE.x, -160, 10, EYE.x, -160, 1000)
  g.addColorStop(0, `rgba(232,166,75,${0.16 * k})`); g.addColorStop(0.45, `rgba(232,166,75,${0.045 * k})`); g.addColorStop(1, 'rgba(232,166,75,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const r = rng(23)
  for (let i = 0; i < 150; i++) {
    const x0 = r() * W, y0 = r() * H, spd = 3 + r() * 8, ph = r() * 6.283, big = r() < 0.05, a0 = r()
    const y = (((y0 - T * spd) % H) + H) % H
    const x = x0 + Math.sin(T * 0.35 + ph) * 8
    const lit = clamp(1 - y / 1500) * clamp(1 - Math.abs(x - EYE.x) / 700)
    spark(sp, x, y, big ? 2 : 0.85, (0.06 + a0 * 0.4) * k * (0.15 + 0.85 * lit), '255,214,150')
  }
}
let paperC: HTMLCanvasElement | null = null
/** 렌즈 속 역광 한지(광심 쪽이 따뜻, 경통 쪽은 그늘) */
function paper() {
  if (paperC) return paperC
  const P = layer()
  off(() => clipCircle(LC.x, LC.y, LC.r, () => {
    hanji(LC.x - LC.r, LC.y - LC.r, LC.r * 2, LC.r * 2, 1, { halo: false })
    ctx.globalCompositeOperation = 'screen'
    const hg = ctx.createRadialGradient(EYE.x, LC.y - LC.r - 60, 0, EYE.x, LC.y - LC.r - 60, 560)
    hg.addColorStop(0, 'rgba(255,214,150,0.42)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.12)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
    ctx.fillStyle = hg; ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h)
    ctx.globalCompositeOperation = 'source-over'
    const g = ctx.createRadialGradient(LC.x, LC.y, LC.r * 0.45, LC.x, LC.y, LC.r)
    g.addColorStop(0, 'rgba(46,34,20,0)'); g.addColorStop(0.72, 'rgba(46,34,20,0.14)'); g.addColorStop(0.93, 'rgba(30,22,14,0.42)'); g.addColorStop(1, 'rgba(10,8,6,0.86)')
    ctx.fillStyle = g; ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h)
  }), P)
  paperC = P.c
  return paperC
}
let darkC: HTMLCanvasElement | null = null
/** 판독이 지나간 렌즈: 한지 불이 꺼진 먹빛(섬유결만 희미하게) */
function darkPaper() {
  if (darkC) return darkC
  const P = layer()
  off(() => clipCircle(LC.x, LC.y, LC.r, () => {
    const g = ctx.createRadialGradient(LC.x, LC.y - 120, 30, LC.x, LC.y, LC.r)
    g.addColorStop(0, '#17130E'); g.addColorStop(0.65, '#0D0C0A'); g.addColorStop(1, '#040404')
    ctx.fillStyle = g; ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h)
    ctx.globalAlpha = 0.07
    ctx.drawImage(paper(), 0, 0)
  }), P)
  darkC = P.c
  return darkC
}
/** 렌즈가 방에 드리우는 한지빛 */
function halo(k: number) {
  if (k <= 0) return
  const g = ctx.createRadialGradient(LC.x, LC.y, LC.r * 0.92, LC.x, LC.y, LC.r * 1.8)
  g.addColorStop(0, `rgba(241,230,207,${0.12 * k})`); g.addColorStop(0.3, `rgba(232,200,150,${0.045 * k})`); g.addColorStop(1, 'rgba(232,200,150,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}
/** 금 테 + 유리 반사 */
function rim(alpha: number) {
  if (alpha <= 0) return
  ctx.save()
  ctx.strokeStyle = C.gold
  ctx.globalAlpha = 0.62 * alpha; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.arc(LC.x, LC.y, LC.r + 0.5, 0, 6.283); ctx.stroke()
  ctx.globalAlpha = 0.16 * alpha; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(LC.x, LC.y, LC.r + 6, 0, 6.283); ctx.stroke()
  ctx.restore()
  const L = tmp()
  L.x.lineCap = 'round'
  L.x.strokeStyle = 'rgba(255,244,220,0.75)'; L.x.lineWidth = 2.4
  L.x.beginPath(); L.x.arc(LC.x, LC.y, LC.r - 18, Math.PI * 1.1, Math.PI * 1.33); L.x.stroke()
  L.x.strokeStyle = 'rgba(255,244,220,0.4)'; L.x.lineWidth = 1.2
  L.x.beginPath(); L.x.arc(LC.x, LC.y, LC.r - 28, Math.PI * 0.1, Math.PI * 0.19); L.x.stroke()
  region(L.c, BOX, 2.5, 0.45 * alpha, 'screen')
}

/* ───────── 얼굴 ───────── */
/** 먹점 얼굴(렌즈 속). s: 거리에 따른 크기, yaw: 고개 돌림(라디안) */
function inkFace(f: Face, o: { s?: number; yaw?: number; alpha?: number } = {}) {
  const s = o.s ?? 1, alpha = o.alpha ?? 1
  const cs = Math.cos(o.yaw ?? 0), sn = Math.sin(o.yaw ?? 0)
  const L = tmp()
  const Wl = tmp()
  const mx = (f.lm[61].x + f.lm[291].x) / 2, my = (f.lm[13].y + f.lm[14].y) / 2, mw = Math.abs(f.lm[291].x - f.lm[61].x) / 2
  const rs = Math.sqrt(s)
  for (const p of f.pts) {
    const x = LC.x + ((p.x - f.cx) * cs + p.s * f.rx * 0.42 * sn) * s
    const y = LC.y + (p.y - f.cy) * s
    const mu = ((p.x - mx) / (mw * 1.2)) ** 2 + ((p.y - my) / (mw * 0.42)) ** 2
    const calm = p.edge && mu < 1 ? 0.55 : 1
    const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5) * alpha * calm
    if (p.r < 0.13) {
      Wl.x.fillStyle = `rgba(28,24,20,${(0.018 + (1 - p.s) ** 2 * 0.11) * alpha})`
      Wl.x.beginPath(); Wl.x.arc(x, y, (7 + p.r * 60) * s, 0, 6.283); Wl.x.fill()
    }
    L.x.fillStyle = `rgba(12,13,15,${a})`
    const rad = (p.edge ? 1.4 + p.r * 1.6 : 0.8 + p.r * 0.9) * rs
    L.x.beginPath(); L.x.arc(x, y, rad, 0, 6.283); L.x.fill()
  }
  region(Wl.c, BOX, 10)
  region(L.c, BOX, 5, 0.5)
  region(L.c, BOX)
}
/** 앰버 점구름(판독된 얼굴). scanY 아래는 그리지 않고, 평면 근처는 희게 달아오른다 */
function amberFace(f: Face, o: { scanY?: number; alpha?: number; glow?: number } = {}) {
  const alpha = o.alpha ?? 1, gl = o.glow ?? 1
  const L = tmp()
  for (const p of f.pts) {
    if (o.scanY != null && p.y > o.scanY + 3) continue
    const near = o.scanY != null ? Math.exp(-((p.y - o.scanY) ** 2) / 700) : 0
    const a = Math.min(1, 0.12 + p.s * 0.55 + near * 0.9 + p.edge * 0.25) * alpha
    L.x.fillStyle = near > 0.35 ? `rgba(255,238,206,${a})` : `rgba(232,166,75,${a})`
    const s = 1.6 + p.edge * 0.6 + near * 0.8
    L.x.fillRect(p.x - s / 2, p.y - s / 2, s, s)
  }
  region(L.c, BOX)
  if (gl > 0) glow(L.c, [3, 14, 40], [0.9 * gl, 0.55 * gl, 0.35 * gl], BOX)
}
/** 주요 랜드마크 표식(+) */
const PINS = [10, 263, 362, 133, 33, 1, 291, 61, 152, 454, 234]
function pins(f: Face, k: number, alpha: number, scanY?: number) {
  if (k <= 0 || alpha <= 0) return
  PINS.forEach((id, i) => {
    const kk = ease.out3(clamp(k * 1.8 - i * 0.07))
    if (kk <= 0) return
    const p = f.lm[id]
    const lit = scanY != null && p.y < scanY
    const col = lit ? C.amberCore : C.celadonDeep
    const s = lerp(16, 6, kk)
    lineA(p.x - s, p.y, p.x + s, p.y, col, 1.3, kk * alpha * (lit ? 0.9 : 0.85))
    lineA(p.x, p.y - s, p.x, p.y + s, col, 1.3, kk * alpha * (lit ? 0.9 : 0.85))
  })
}

/* ───────── 계기 ───────── */
/** 72눈금 링. prog: 시계방향 점등, scanY: 평면과 만나는 눈금이 달아오름, flare: 셔터 순간 */
function ring(prog: number, alpha: number, sp: Ctx, o: { scanY?: number; flare?: number } = {}) {
  if (alpha <= 0) return
  const n = 72
  const lead = prog * n
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    const major = i % 6 === 0
    const len = major ? 16 : 8
    const c = Math.cos(a), s = Math.sin(a)
    const x0 = LC.x + c * RING, y0 = LC.y + s * RING, x1 = LC.x + c * (RING + len), y1 = LC.y + s * (RING + len)
    const lit = clamp(lead - i)
    lineA(x0, y0, x1, y1, C.celadon, major ? 1.8 : 1.1, (0.14 + 0.72 * lit) * (major ? 1 : 0.8) * alpha)
    let hot = 0
    if (prog > 0 && prog < 1) { const d = lead - i; if (d > 0 && d < 4) hot = (1 - d / 4) ** 1.5 }
    if (o.scanY != null) hot = Math.max(hot, Math.exp(-(((y0 - o.scanY) / 24) ** 2)))
    if (o.flare) hot = Math.max(hot, o.flare)
    if (hot > 0.02) {
      sp.strokeStyle = `rgba(255,214,150,${hot * alpha})`
      sp.lineWidth = major ? 2 : 1.4
      sp.beginPath(); sp.moveTo(x0, y0); sp.lineTo(x1, y1); sp.stroke()
    }
  }
}
/** 광심: 카메라 자리의 빛점. look: 시선이 맞을 때의 밝아짐 */
function eyeLight(T: number, k: number, sp: Ctx, look = 0, pulse = 1) {
  if (k <= 0) return
  spark(sp, EYE.x, EYE.y, 3.4 + look * 1.4, k)
  spark(sp, EYE.x, EYE.y, 9, (0.18 + 0.3 * look) * k)
  ctx.save()
  ctx.strokeStyle = C.celadon
  ctx.globalAlpha = 0.34 * k; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(EYE.x, EYE.y, 17, 0, 6.283); ctx.stroke()
  ctx.globalAlpha = 0.14 * k
  ctx.beginPath(); ctx.arc(EYE.x, EYE.y, 31, 0, 6.283); ctx.stroke()
  const ph = ((T / 2.4) % 1 + 1) % 1
  if (pulse > 0) {
    ctx.globalAlpha = 0.42 * (1 - ph) * k * pulse
    ctx.strokeStyle = C.amber
    ctx.beginPath(); ctx.arc(EYE.x, EYE.y, 12 + 40 * ease.out3(ph), 0, 6.283); ctx.stroke()
  }
  ctx.restore()
  for (const d of [-1, 1]) lineA(EYE.x + d * 40, EYE.y, EYE.x + d * 64, EYE.y, C.celadon, 1, 0.4 * k)
  text('光心', EYE.x + 78, EYE.y + 6, `400 17px ${FONT.serif}`, C.celadon, { alpha: 0.62 * k, spacing: 4 })
}

interface Gauge { hz: string; ko: string; unit: string; min: number; max: number; lo: number; hi: number; v0: number; v1: number; a: number; b: number; x: number; dec: number; sign?: boolean }
/** 거리 → 조도 → 정면도 순으로 적정 범위에 든다 */
const GA: Gauge[] = [
  { hz: '距離', ko: '거리', unit: 'cm', min: 30, max: 100, lo: 50, hi: 70, v0: 86, v1: 62, a: 1.45, b: 2.3, x: 252, dec: 0 },
  { hz: '照度', ko: '조도', unit: 'lx', min: 0, max: 1000, lo: 300, hi: 800, v0: 150, v1: 420, a: 2.05, b: 2.9, x: 540, dec: 0 },
  { hz: '正面', ko: '정면도', unit: '°', min: -30, max: 30, lo: -5, hi: 5, v0: -17, v1: 1.2, a: 2.65, b: 3.5, x: 828, dec: 1, sign: true },
]
/** 센서 값(바늘 기상 전). t6: S06 기준 시각 */
function rawV(g: Gauge, t6: number, T: number) {
  const span = g.max - g.min, ph = g.x * 0.013
  const jit = (Math.sin(T * 4.7 + ph) * 0.6 + Math.sin(T * 7.9 + ph * 3) * 0.4) * span * 0.028
  const tremor = (Math.sin(T * 3.3 + ph) * 0.5 + Math.sin(T * 5.9 + ph) * 0.5) * span * 0.0022
  const k = ease.p4out(seg(t6, g.a, g.b))
  return lerp(g.v0 + jit, g.v1 + tremor, k)
}
/** 바늘 값(처음엔 최소값에서 깨어난다) */
function needleV(g: Gauge, t6: number, T: number) {
  return lerp(g.min, rawV(g, t6, T), ease.out3(seg(t6, 0.95, 1.45)))
}
function fmt(g: Gauge, v: number) {
  const s = Math.abs(v).toFixed(g.dec)
  return g.sign ? (v < 0 ? '−' : '+') + s : s
}
/** 청자 반원 계기 하나 */
function dial(g: Gauge, v: number, alpha: number, sp: Ctx) {
  if (alpha <= 0) return
  const cx = g.x, cy = DIAL_Y, R = 98
  const ang = (val: number) => Math.PI + clamp((val - g.min) / (g.max - g.min)) * Math.PI
  const out = v < g.lo ? g.lo - v : v > g.hi ? v - g.hi : 0
  const inK = clamp(1 - out / ((g.hi - g.lo) * 0.3))
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (i / 40) * Math.PI
    const major = i % 10 === 0, mid = i % 5 === 0
    const r1 = R + (major ? 15 : mid ? 10 : 6)
    lineA(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, C.celadon, major ? 1.4 : 1, (major ? 0.72 : mid ? 0.46 : 0.26) * alpha)
  }
  ctx.save()
  ctx.strokeStyle = C.celadon
  ctx.globalAlpha = 0.2 * alpha; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, R - 10, Math.PI, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = (0.28 + 0.62 * inK) * alpha; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(cx, cy, R - 10, ang(g.lo), ang(g.hi)); ctx.stroke()
  ctx.restore()
  const a = ang(v)
  lineA(cx - Math.cos(a) * 16, cy - Math.sin(a) * 16, cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), C.hanji, 1.4, 0.95 * alpha)
  spark(sp, cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), 2.4, alpha * (0.5 + 0.5 * (1 - inK)))
  ctx.save()
  ctx.globalAlpha = alpha; ctx.fillStyle = C.void; ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 6.283); ctx.fill(); ctx.stroke()
  ctx.restore()
  lineA(cx - R - 24, cy, cx + R + 24, cy, C.celadon, 1, 0.22 * alpha)
  mono(String(g.min), cx - R, cy + 22, C.celadonDeep, 14, 'center', 0.9 * alpha)
  mono(String(g.max), cx + R, cy + 22, C.celadonDeep, 14, 'center', 0.9 * alpha)
  const vs = fmt(g, v)
  const vf = `300 36px ${FONT.mono}`
  const vw = textW(vs, vf, 3.6)
  const uw = textW(g.unit, `300 18px ${FONT.mono}`, 1.8)
  const vx = cx - (vw + 8 + uw) / 2
  text(vs, vx, cy + 62, vf, inK > 0.9 ? C.hanji : C.amber, { alpha, spacing: 3.6 })
  mono(g.unit, vx + vw + 8, cy + 62, C.hanjiShadow, 18, 'left', alpha)
  text(g.hz, cx - 6, cy + 104, `200 26px ${FONT.serif}`, C.celadon, { align: 'right', alpha, spacing: 4 })
  text(g.ko, cx + 6, cy + 102, `400 20px ${FONT.sans}`, C.hanjiShadow, { alpha, spacing: 1 })
  mono(`適 ${g.lo}–${g.hi}`, cx, cy + 134, inK > 0.9 ? C.celadon : C.ash, 15, 'center', 0.8 * alpha)
}
function dials(t6: number, T: number, alpha: number, sp: Ctx) {
  if (alpha <= 0) return
  GA.forEach((g, i) => dial(g, needleV(g, t6, T), alpha * ease.sine(seg(t6, 0.95 + i * 0.1, 1.45 + i * 0.1)), sp))
}

/* ───────── 조리개 (S05의 닫힘과 짝) ───────── */
function aperture(cx: number, cy: number, r: number, rot: number) {
  const n = 8, L = 2600
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) }
  const dir = (i: number) => {
    const [ax, ay] = pts[i % n], [bx, by] = pts[(i + 1) % n]
    const l = Math.hypot(bx - ax, by - ay) || 1
    return [(bx - ax) / l, (by - ay) / l] as const
  }
  const ea = clamp(r / 160)
  ctx.save()
  ctx.fillStyle = '#060708'
  ctx.beginPath(); ctx.rect(0, 0, W, H)
  ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath()
  ctx.fill('evenodd')
  for (let i = 0; i < n; i++) {
    const p = pts[(i + 1) % n], q = pts[(i + 2) % n]
    const [ux, uy] = dir(i), [vx, vy] = dir(i + 1)
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2
    const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1
    const g = ctx.createLinearGradient(mx, my, mx + (ox / ol) * 700, my + (oy / ol) * 700)
    const hi = i % 2 ? 0.09 : 0.06
    g.addColorStop(0, `rgba(40,42,44,${0.6 + hi})`); g.addColorStop(0.12, 'rgba(22,24,26,1)'); g.addColorStop(1, 'rgba(8,9,10,1)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] + vx * L, q[1] + vy * L); ctx.lineTo(p[0] + ux * L, p[1] + uy * L); ctx.closePath(); ctx.fill()
  }
  for (let i = 0; i < n; i++) {
    const [bx, by] = pts[(i + 1) % n]
    const [ux, uy] = dir(i)
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#000'; ctx.lineWidth = 12; ctx.filter = 'blur(7px)'
    ctx.beginPath(); ctx.moveTo(bx + uy * 7, by - ux * 7); ctx.lineTo(bx + ux * L + uy * 7, by + uy * L - ux * 7); ctx.stroke(); ctx.restore()
    hair(bx, by, bx + ux * L, by + uy * L, C.gold, 1, 0.3 * ea)
  }
  ctx.globalAlpha = 0.6 * ea
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.stroke()
  ctx.restore()
}

/* ───────── S06 ───────── */
/** 렌즈 정렬 십자선(카메라 레티클 — 영상이 흐려도 늘 선명) */
function reticle(alpha: number) {
  if (alpha <= 0) return
  clipCircle(LC.x, LC.y, LC.r, () => {
    lineA(LC.x - LC.r, LC.y, LC.x - 30, LC.y, C.celadonDeep, 1, 0.42 * alpha)
    lineA(LC.x + 30, LC.y, LC.x + LC.r, LC.y, C.celadonDeep, 1, 0.42 * alpha)
    lineA(LC.x, LC.y - LC.r, LC.x, LC.y - 30, C.celadonDeep, 1, 0.42 * alpha)
    lineA(LC.x, LC.y + 30, LC.x, LC.y + LC.r, C.celadonDeep, 1, 0.42 * alpha)
    for (let i = -9; i <= 9; i++) {
      if (i === 0) continue
      const d = i * 40, l = i % 3 === 0 ? 9 : 5
      lineA(LC.x + d, LC.y - l, LC.x + d, LC.y + l, C.celadonDeep, 1, 0.36 * alpha)
      lineA(LC.x - l, LC.y + d, LC.x + l, LC.y + d, C.celadonDeep, 1, 0.36 * alpha)
    }
  })
}

const S06: Scene = {
  id: 'S06',
  act: ACT,
  title: '조리개가 열리고, 먹으로 비치다',
  note: '닫혔던 8엽 조리개가 같은 자리에서 열려 원형 렌즈가 되고, 렌즈 속 한지에 관람자가 먹점 얼굴로 비친다. 아래 청자 계기(거리·조도·정면도)의 바늘이 하나씩 적정 범위에 들 때마다 초점·밝기·고개 방향이 맞춰진다.',
  dur: 4,
  render(t) {
    const T = T0.S06 + t
    const f = getFace()
    const SP = tmp()
    const kOpen = ease.inOut3(seg(t, 0.08, 1.6))
    const push = lerp(1.07, 1, ease.out3(seg(t, 0.05, 2.6)))
    const kUI = ease.sine(seg(t, 0.85, 1.45))
    // 판독 상태가 렌즈 속 영상을 바로잡는다: 거리→크기·초점, 조도→한지 밝기, 정면도→고개
    const d = rawV(GA[0], t, T), lx = rawV(GA[1], t, T), yawDeg = rawV(GA[2], t, T)
    const sc = clamp(62 / d, 0.6, 1.2)
    const foc = Math.min(11, Math.abs(d - 62) * 0.46)
    const pg = lerp(0.36, 0.95, clamp((lx - 150) / 270))
    const look = Math.sin(Math.PI * seg(t, 3.25, 3.95))
    camera(push, () => {
      room(T, 0.3 + 0.7 * kOpen, SP.x)
      halo(pg * kOpen)
      const img = off(() => {
        region(paper(), BOX, 0, pg)
        inkFace(f, { s: sc, yaw: (yawDeg * Math.PI) / 180, alpha: 0.5 + 0.5 * clamp((pg - 0.36) / 0.59) })
      })
      region(img, BOX, foc)
      reticle(kUI)
      rim(kOpen)
      ring(0, kUI * 0.9, SP.x)
      eyeLight(T, kUI, SP.x, look)
      lightLine(EYE.x, EYE.y + 40, EYE.x, LC.y - RING - 26, seg(t, 1.0, 1.6), C.celadon, 1, 0.45, SP.x)
      dials(t, T, 1, SP.x)
      flush(SP)
    })
    guide('빛의 중심을 바라봐 주세요', seg(t, 1.55, 2.3), 0.84 + 0.16 * Math.cos((T - 1.55) * 2.4))
    vignette(0.6)
    head(1, 1, 1, ease.sine(seg(t, 0.45, 1.1)))
    disclaimer(ease.sine(seg(t, 0.5, 1.1)))
    if (kOpen < 1) aperture(LC.x, LC.y, lerp(0, 1420, kOpen), 0.75 - 0.6 * kOpen)
    blackout(1 - seg(t, 0, 0.1))
  },
}

/* ───────── S07 ───────── */
const LOCK = 1.5
/** 조준 고정 슬레이트 (아래 띠) */
function slate(t: number, alpha: number, sp: Ctx) {
  if (alpha <= 0) return
  const y = 1376
  const kAcq = ease.sine(seg(t, 0.45, 0.8)) * (1 - seg(t, LOCK - 0.05, LOCK + 0.1))
  if (kAcq > 0) {
    const blink = 0.55 + 0.45 * (Math.cos(t * 9) > 0 ? 1 : 0.35)
    mono('ACQUIRING', W / 2, y, C.ash, 30, 'center', kAcq * blink * alpha)
    const dots = Math.floor(t * 6) % 4
    mono('·'.repeat(dots), W / 2 + 118, y, C.ash, 30, 'left', kAcq * alpha)
  }
  const kL = seg(t, LOCK, LOCK + 0.45)
  if (kL > 0) {
    const font = `400 46px ${FONT.mono}`
    const s = 'LOCK · 01'
    const w = textW(s, font, 12)
    const e = ease.out3(kL)
    text(s, W / 2 + 6, y, font, C.amber, { align: 'center', spacing: 12, alpha: e * alpha, blur: (1 - e) * 8 })
    const hot = (1 - ease.sine(seg(t, LOCK + 0.1, LOCK + 0.7)))
    text(s, W / 2 + 6, y, font, C.amberCore, { align: 'center', spacing: 12, alpha: hot * e * alpha })
    const hw = lerp(0, 260, ease.p4out(kL))
    lineA(W / 2 - w / 2 - 30 - hw, y - 16, W / 2 - w / 2 - 30, y - 16, C.amber, 1, 0.6 * alpha)
    lineA(W / 2 + w / 2 + 30, y - 16, W / 2 + w / 2 + 30 + hw, y - 16, C.amber, 1, 0.6 * alpha)
    spark(sp, W / 2 - w / 2 - 30 - hw, y - 16, 2, (1 - kL) * alpha)
    spark(sp, W / 2 + w / 2 + 30 + hw, y - 16, 2, (1 - kL) * alpha)
    mono('FACE MESH 478 PTS · CONF 0.97 · HOLD', W / 2, y + 50, C.ash, 17, 'center', ease.sine(seg(t, LOCK + 0.25, LOCK + 0.7)) * alpha * 0.9)
  }
}
/** 브래킷(얼굴 경계로 수렴) — 고정 순간 앰버로 달아오른다 */
function faceBrackets(f: Face, k: number, alpha: number, lockK: number, sp: Ctx) {
  if (k <= 0 || alpha <= 0) return
  const b = faceBox(f)
  ctx.save()
  ctx.globalAlpha = alpha * ease.sine(clamp(k * 3))
  brackets(b.x0, b.y0, b.x1, b.y1, k, lockK > 0 ? C.amber : C.hanji, 40, 1.6)
  ctx.restore()
  if (lockK > 0 && lockK < 1) {
    const prev = ctx
    setCtx(sp)
    ctx.save(); ctx.globalAlpha = (1 - ease.sine(lockK)) * alpha
    brackets(b.x0, b.y0, b.x1, b.y1, 1, C.amberCore, 40, 2.4)
    ctx.restore()
    setCtx(prev)
  }
}

const S07: Scene = {
  id: 'S07',
  act: ACT,
  title: '조준 고정',
  note: '계기들이 초점 밖으로 물러나고, 화면 모서리에서 네 브래킷이 얼굴 경계로 수렴한다. 렌즈 둘레 72눈금이 시계방향으로 켜져 한 바퀴를 닫는 순간 앰버 “LOCK · 01”이 새겨지고 랜드마크 표식이 맺힌다.',
  dur: 2.5,
  render(t) {
    const T = T0.S07 + t
    const f = getFace()
    const SP = tmp()
    const kDial = 1 - ease.sine(seg(t, 0.15, 0.85))
    const dBlur = 7 * ease.sine(seg(t, 0.1, 0.8))
    const kBr = seg(t, 0.2, 1.35)
    const kRing = ease.inOut3(seg(t, 0.3, LOCK))
    const lockK = seg(t, LOCK, LOCK + 0.6)
    room(T, 1, SP.x)
    halo(0.95)
    const img = off(() => { region(paper(), BOX, 0, 0.95); inkFace(f) })
    region(img, BOX)
    reticle(1 - ease.sine(seg(t, 0.1, 0.7)))
    pins(f, seg(t, LOCK + 0.05, LOCK + 0.75), 1)
    rim(1)
    ring(kRing, 0.9 + 0.1 * kRing, SP.x, { flare: lockK > 0 ? (1 - ease.sine(lockK)) * 0.8 : 0 })
    // 고정 순간 링 바깥으로 번지는 청자 파동
    if (lockK > 0 && lockK < 1) {
      ctx.save(); ctx.strokeStyle = C.celadon; ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.55 * (1 - ease.sine(lockK))
      ctx.beginPath(); ctx.arc(LC.x, LC.y, RING + 18 + 70 * ease.out3(lockK), 0, 6.283); ctx.stroke(); ctx.restore()
    }
    faceBrackets(f, kBr, 0.92, lockK, SP.x)
    if (lockK > 0) {
      const b = faceBox(f)
      mono('01', b.x0, b.y0 - 16, C.amber, 18, 'left', ease.sine(lockK))
      mono('478', b.x1, b.y1 + 34, C.amber, 16, 'right', 0.8 * ease.sine(lockK))
    }
    eyeLight(T, 1, SP.x, 0, 1 - seg(t, LOCK - 0.3, LOCK))
    lineA(EYE.x, EYE.y + 40, EYE.x, LC.y - RING - 26, C.celadon, 1, 0.45)
    // 계기: 랙 포커스로 물러난다
    if (kDial > 0) {
      const D = tmp()
      off(() => dials(4 + t, T, 1, D.x), D)
      region(D.c, { x: 0, y: 1200, w: W, h: 360 }, dBlur, kDial)
    }
    slate(t, 1, SP.x)
    flush(SP)
    const kG = seg(t, 0.35, 1.0)
    guide('빛의 중심을 바라봐 주세요', 1 - kG, 1)
    guide('잠시 그대로 계세요', kG, 1)
    vignette(0.6)
    head(1, 2, seg(t, 0, 0.4))
    disclaimer()
  },
}

/* ───────── S08 ───────── */
const SCAN = { a: 0.3, b: 3.0 }
function scanY(t: number, f: Face) {
  const Z = zones(f)
  return lerp(LC.y - LC.r - 8, Z.chin + 16, ease.p4out(seg(t, SCAN.a, SCAN.b)))
}
/** 옆얼굴 깊이(추정) — 랜드마크 높이에 맞춘 단면 */
function profilePts(f: Face): [number, number][] {
  const Z = zones(f), L = f.lm
  const raw: [number, number][] = [
    [Z.top, 0.1], [L[10].y, 0.2], [(L[10].y + L[9].y) / 2, 0.3], [L[9].y - 10, 0.31], [L[168].y, 0.24],
    [lerp(L[168].y, L[1].y, 0.5), 0.55], [L[1].y - 6, 0.94], [L[1].y + 6, 0.92], [L[2].y, 0.6], [lerp(L[2].y, L[13].y, 0.5), 0.52],
    [L[13].y - 4, 0.64], [(L[13].y + L[14].y) / 2, 0.52], [L[14].y + 2, 0.6], [L[14].y + 44, 0.4], [L[152].y - 52, 0.52],
    [L[152].y - 18, 0.46], [L[152].y, 0.28], [L[152].y + 14, 0.08],
  ]
  return raw.map(([y, z]) => [PROF_X + z * 46, y])
}
/** 왼쪽 계측 기둥: S08 주사 진척 → S09 삼정 기둥 */
function scaleCol(f: Face, k: number, minor: number, sy: number | null, sp: Ctx) {
  if (k <= 0) return
  const Z = zones(f)
  const y0 = Z.top, y1 = Z.chin
  lightLine(SCALE_X, y0, SCALE_X, y1, k, C.celadon, 1, 0.5, sp)
  const n = 32
  for (let i = 0; i <= n; i++) {
    const y = lerp(y0, y1, i / n)
    if ((y - y0) / (y1 - y0) > ease.out3(k)) break
    const major = i % 4 === 0
    lineA(SCALE_X, y, SCALE_X + (major ? 14 : 7), y, C.celadon, 1, (major ? 0.55 : 0.3) * minor)
  }
  for (const y of [Z.top, Z.brow, Z.base, Z.chin]) lineA(SCALE_X - 8, y, SCALE_X + 18, y, C.celadon, 1.4, 0.7 * k)
  if (sy != null && sy > y0 - 30) {
    const yy = clamp(sy, y0, y1)
    ctx.save(); ctx.fillStyle = C.amberCore; ctx.globalAlpha = k
    ctx.beginPath(); ctx.moveTo(SCALE_X - 4, yy); ctx.lineTo(SCALE_X - 16, yy - 7); ctx.lineTo(SCALE_X - 16, yy + 7); ctx.closePath(); ctx.fill(); ctx.restore()
    const pct = clamp((yy - y0) / (y1 - y0)) * 100
    mono(String(Math.round(pct)).padStart(3, '0'), SCALE_X - 22, yy + 6, C.amber, 16, 'right', k * 0.95)
  }
}
function profile(f: Face, sy: number, k: number, sp: Ctx) {
  if (k <= 0) return
  const Z = zones(f)
  lineA(PROF_X, Z.top, PROF_X, Z.chin, C.celadon, 1, 0.22 * k)
  text('側', PROF_X + 20, Z.top - 16, `400 18px ${FONT.serif}`, C.celadon, { align: 'center', alpha: 0.7 * k })
  const P = profilePts(f)
  ctx.save()
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.9 * k; ctx.lineJoin = 'round'
  ctx.beginPath()
  let hx = P[0][0], hy = P[0][1], started = false
  for (let i = 0; i < P.length; i++) {
    const [x, y] = P[i]
    if (y <= sy) { if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y); hx = x; hy = y }
    else if (i > 0 && P[i - 1][1] < sy) {
      const u = (sy - P[i - 1][1]) / (y - P[i - 1][1])
      hx = lerp(P[i - 1][0], x, u); hy = sy
      ctx.lineTo(hx, hy)
      break
    }
  }
  ctx.stroke(); ctx.restore()
  if (sy < Z.chin + 10) spark(sp, hx, hy, 2.2, k)
}
/** 판독점 계수기 (아래 띠) */
function counter(f: Face, sy: number, alpha: number) {
  if (alpha <= 0) return
  let n = 0
  for (const p of f.lm) if (p.y < sy) n++
  const y = 1414
  mono('判讀點 · LANDMARKS', W / 2, 1262, C.celadon, 17, 'center', 0.85 * alpha)
  text(String(n).padStart(3, '0'), W / 2 + 34, y, `italic 300 150px ${FONT.italic}`, n >= 478 ? C.pearl : C.amberCore, { align: 'right', alpha })
  mono('/ 478', W / 2 + 50, y - 6, C.ash, 26, 'left', alpha)
  mono('468 MESH + 10 IRIS', W / 2, y + 46, C.ash, 15, 'center', 0.7 * alpha)
}
/** 렌즈: 평면 위는 판독된 어둠+앰버, 아래는 한지+먹. cap: 턱 아래 남은 한지가 먹빛으로 잠기는 정도 */
function scanLens(f: Face, sy: number, cap: number, glowK = 0.9) {
  const below = off(() => { region(paper(), BOX, 0, 0.95); inkFace(f) })
  clipCircle(LC.x, LC.y, LC.r, () => {
    ctx.drawImage(darkPaper(), 0, 0)
    // 아래: 한지와 먹 얼굴 (턱 아래 남은 자리는 마지막에 위에서부터 어둠이 번져 내려온다)
    const cut = lerp(sy, LC.y + LC.r + 90, ease.sine(cap))
    const M = tmp()
    M.x.drawImage(below, 0, 0)
    M.x.globalCompositeOperation = 'destination-in'
    const g = M.x.createLinearGradient(0, Math.max(sy, cut - 90), 0, Math.max(sy + 1, cut))
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)')
    M.x.fillStyle = g
    M.x.fillRect(0, sy, W, H - sy)
    region(M.c, BOX)
    // 위: 한지 불이 막 꺼진 자리의 잔광 + 앰버 점구름
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, sy); ctx.clip()
    const ag = ctx.createLinearGradient(0, sy - 110, 0, sy)
    ag.addColorStop(0, 'rgba(241,230,207,0)'); ag.addColorStop(1, 'rgba(241,230,207,0.2)')
    ctx.fillStyle = ag; ctx.fillRect(BOX.x, sy - 110, BOX.w, 110)
    amberFace(f, { scanY: sy, glow: glowK })
    ctx.restore()
  })
}
/** 스캔 평면: 렌즈 현을 가로지르는 백열선 + 방을 가로지르는 희미한 투영선 */
function plane(y: number, k: number, sp: Ctx) {
  if (k <= 0) return
  const dy = y - LC.y
  const hw = Math.sqrt(Math.max(0, LC.r * LC.r - dy * dy))
  lineA(72, y, W - 72, y, C.amber, 1, 0.3 * k)
  if (hw > 2) {
    const g = ctx.createLinearGradient(0, y - 60, 0, y)
    g.addColorStop(0, 'rgba(255,208,138,0)'); g.addColorStop(1, `rgba(255,208,138,${0.26 * k})`)
    clipCircle(LC.x, LC.y, LC.r, () => { ctx.fillStyle = g; ctx.fillRect(LC.x - hw, y - 60, hw * 2, 60) })
    const lg = sp.createLinearGradient(LC.x - hw - 40, 0, LC.x + hw + 40, 0)
    lg.addColorStop(0, 'rgba(255,240,210,0)'); lg.addColorStop(0.08, `rgba(255,240,210,${k})`); lg.addColorStop(0.92, `rgba(255,240,210,${k})`); lg.addColorStop(1, 'rgba(255,240,210,0)')
    sp.fillStyle = lg
    sp.fillRect(LC.x - hw - 40, y - 1.2, hw * 2 + 80, 2.4)
  }
  spark(sp, 72, y, 2, 0.6 * k)
  spark(sp, W - 72, y, 2, 0.6 * k)
}

const S08: Scene = {
  id: 'S08',
  act: ACT,
  title: '빛의 주사',
  note: '앰버 스캔 평면이 이마에서 턱으로 내려간다(파워4 감속). 평면이 지난 자리는 한지 불이 꺼지고 먹점이 앰버 점구름으로 깨어나며, 왼쪽 기둥의 진척·오른쪽 옆얼굴 단면·판독점 수가 함께 새겨진다.',
  dur: 3.5,
  render(t) {
    const T = T0.S08 + t
    const f = getFace()
    const SP = tmp()
    const sy = scanY(t, f)
    const kPl = ease.sine(seg(t, 0.18, 0.4)) * (1 - ease.sine(seg(t, 2.85, 3.35)))
    const cap = seg(t, 2.55, 3.4)
    const kSide = ease.sine(seg(t, 0.05, 0.5))
    room(T, 1, SP.x)
    halo(0.95 * (1 - 0.75 * ease.sine(seg(t, 0.3, 3.3))))
    scanLens(f, sy, cap)
    pins(f, 1, 1 - 0.25 * seg(t, 0.4, 2.5), sy)
    rim(1)
    ring(1, 1, SP.x, { scanY: kPl > 0.05 ? sy : undefined })
    faceBrackets(f, 1, 0.92 - 0.5 * ease.sine(seg(t, 0.2, 1.2)), 2, SP.x)
    eyeLight(T, 1, SP.x, 0, 0)
    lineA(EYE.x, EYE.y + 40, EYE.x, LC.y - RING - 26, C.celadon, 1, 0.45)
    plane(sy, kPl, SP.x)
    scaleCol(f, kSide, kSide, sy, SP.x)
    profile(f, sy, kSide, SP.x)
    // 아래 띠: 고정 슬레이트 → 판독점 계수기
    const kSw = seg(t, 0.05, 0.5)
    if (kSw < 1) {
      const S = tmp()
      off(() => slate(2.5, 1, S.x), S)
      region(S.c, { x: 0, y: 1300, w: W, h: 160 }, 6 * ease.sine(kSw), 1 - ease.sine(kSw))
    }
    counter(f, sy, ease.sine(seg(t, 0.3, 0.7)))
    flush(SP)
    const kG = seg(t, 0.2, 0.85)
    guide('잠시 그대로 계세요', 1 - kG)
    guide('빛이 얼굴을 지나갑니다', kG)
    vignette(0.6)
    head(2, 3, seg(t, 0, 0.4))
    disclaimer()
  },
}

/* ───────── S09 ───────── */
const SHUT = 2.55
const ZONE = [
  { hz: '天', name: '上停', ratio: '0.27' },
  { hz: '人', name: '中停', ratio: '0.33' },
  { hz: '地', name: '下停', ratio: '0.39' },
]
const LTAG = ['髮際', '眉間', '鼻下', '頤端']
/** 지시선 판독(아래 띠): 눈·코·턱 */
function readSpec(f: Face) {
  const L = f.lm
  const eyeY = Math.max(L[263].y, L[362].y) + 24
  const noseY = (L[358].y + L[129].y) / 2
  const jawY = (L[397].y + L[172].y) / 2 + 6
  const top = 1236
  return [
    { hz: '目', val: '0.22', ko: '눈 너비 비', x: 210, span: [L[263].x, L[362].x, eyeY], lead: [[L[263].x, eyeY], [210, eyeY], [210, top]] as [number, number][], at: 1.05 },
    { hz: '鼻廣', val: '0.35', ko: '코 너비 비', x: 870, span: [L[358].x, L[129].x, noseY], lead: [[L[129].x, noseY], [870, noseY], [870, top]] as [number, number][], at: 1.3 },
    { hz: '頤', val: '0.80', ko: '턱 너비 비', x: 540, span: [L[397].x, L[172].x, jawY], lead: [[(L[397].x + L[172].x) / 2, jawY], [(L[397].x + L[172].x) / 2, top]] as [number, number][], at: 1.55 },
  ]
}
/** 치수선: 가운데서 양쪽으로 그어지고 끝에 눈금 */
function span(x0: number, x1: number, y: number, k: number, color: string, alpha: number, sp?: Ctx) {
  if (k <= 0 || alpha <= 0) return
  const e = ease.out3(clamp(k)), cx = (x0 + x1) / 2, hw = ((x1 - x0) / 2) * e
  lineA(cx - hw, y, cx + hw, y, color, 1.2, alpha)
  const ke = seg(k, 0.7, 1)
  for (const x of [x0, x1]) lineA(x, y - 9 * ke, x, y + 9 * ke, color, 1.2, alpha)
  if (sp && k < 1) { spark(sp, cx - hw, y, 2, alpha); spark(sp, cx + hw, y, 2, alpha) }
}
/** 계측 도해. lensCol: 렌즈 안쪽 선 색(채록 후 한지 위에서는 짙은 청자) */
function measure(f: Face, t: number, alpha: number, lensCol: string, sp?: Ctx) {
  const Z = zones(f)
  const ys = [Z.top, Z.brow, Z.base, Z.chin]
  const draw = (col: string) => {
    ys.forEach((y, i) => lightLine(SCALE_X + 18, y, PROF_X - 16, y, seg(t, 0.15 + i * 0.12, 0.7 + i * 0.12), col, 1, 0.85 * alpha, sp))
    // 정중선
    const kM = ease.out3(seg(t, 0.55, 1.1))
    if (kM > 0) {
      ctx.save(); ctx.setLineDash([5, 7]); ctx.strokeStyle = col; ctx.globalAlpha = 0.5 * alpha; ctx.lineWidth = 1
      const mx = f.lm[168].x
      ctx.beginPath(); ctx.moveTo(mx, Z.top); ctx.lineTo(mx, lerp(Z.top, Z.chin, kM)); ctx.stroke(); ctx.restore()
    }
    for (const r of readSpec(f)) {
      span(r.span[0], r.span[1], r.span[2], seg(t, r.at, r.at + 0.3), col, 0.95 * alpha, sp)
      polyLine(r.lead, seg(t, r.at + 0.22, r.at + 0.6), col, 1, 0.75 * alpha, sp)
    }
  }
  // 렌즈 밖
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(LC.x, LC.y, LC.r, 0, 6.283); ctx.clip('evenodd')
  draw(C.celadon)
  ctx.restore()
  // 렌즈 안
  clipCircle(LC.x, LC.y, LC.r, () => draw(lensCol))
}
/** 삼정 라벨(왼쪽)·비율(오른쪽)·선 이름 */
function zoneLabels(f: Face, t: number, alpha: number) {
  const Z = zones(f)
  const ys = [Z.top, Z.brow, Z.base, Z.chin]
  ys.forEach((y, i) => {
    const k = ease.sine(seg(t, 0.45 + i * 0.12, 0.85 + i * 0.12))
    text(LTAG[i], SCALE_X - 14, y + 6, `400 15px ${FONT.serif}`, C.celadon, { align: 'right', alpha: 0.7 * k * alpha, spacing: 1 })
  })
  mono('推定', SCALE_X + 26, Z.top - 10, C.ash, 13, 'left', 0.7 * ease.sine(seg(t, 0.5, 0.9)) * alpha)
  ZONE.forEach((z, i) => {
    const y0 = ys[i], y1 = ys[i + 1], ym = (y0 + y1) / 2
    const k = seg(t, 0.62 + i * 0.16, 1.1 + i * 0.16)
    const e = ease.out3(k)
    text(z.hz, 82, ym - 4, `200 40px ${FONT.serif}`, C.hanji, { align: 'center', alpha: e * alpha, blur: (1 - e) * 8 })
    ;[...z.name].forEach((ch, j) => text(ch, 82, ym + 30 + j * 21, `400 17px ${FONT.serif}`, C.celadon, { align: 'center', alpha: 0.8 * e * alpha }))
    engrave(z.ratio, W - 70, ym + 10, 26, seg(t, 0.75 + i * 0.16, 1.25 + i * 0.16), 'right', C.hanji, alpha)
  })
}
function readouts(f: Face, t: number, alpha: number) {
  for (const r of readSpec(f)) {
    const k = seg(t, r.at + 0.5, r.at + 0.95)
    if (k <= 0) continue
    const e = ease.out3(k)
    text(r.hz, r.x, 1290, `200 32px ${FONT.serif}`, C.celadon, { align: 'center', alpha: e * alpha, blur: (1 - e) * 6, spacing: 4 })
    engrave(r.val, r.x, 1352, 46, k, 'center', C.pearl, alpha)
    text(r.ko, r.x, 1392, `400 19px ${FONT.sans}`, C.hanjiShadow, { align: 'center', alpha: 0.9 * e * alpha, spacing: 1 })
  }
}

const S09: Scene = {
  id: 'S09',
  act: ACT,
  title: '삼정 계측, 그리고 채록',
  note: '빛이 天·人·地 경계에 청자 가는 선을 긋고 上停·中停·下停 비율(0.27·0.33·0.39)이 새겨진 뒤, 눈·코·턱의 치수선과 지시선 수치가 아래로 내려 적힌다. 부드러운 셔터 섬광이 지나가면 렌즈엔 채록된 먹 초상만 남는다.',
  dur: 3.5,
  render(t) {
    const T = T0.S09 + t
    const f = getFace()
    const SP = tmp()
    const fl = ease.sine(seg(t, SHUT - 0.06, SHUT)) * (1 - ease.out3(seg(t, SHUT, SHUT + 0.75)))
    const cap = t >= SHUT ? 1 : 0
    const kOut = ease.sine(seg(t, 0, 0.45))
    room(T, 1, SP.x)
    halo(cap ? 0.6 + 0.35 * ease.sine(seg(t, SHUT, 3.4)) : 0.24)
    if (!cap) {
      clipCircle(LC.x, LC.y, LC.r, () => {
        ctx.drawImage(darkPaper(), 0, 0)
        amberFace(f, { glow: lerp(0.9, 0.6, ease.sine(seg(t, 0.1, 1.2))), alpha: lerp(1, 0.85, ease.sine(seg(t, 0.1, 1.2))) })
      })
    } else {
      // 채록: 섬광 뒤 한지 위에 먹 초상이 정착한다
      const img = off(() => { region(paper(), BOX, 0, 0.92); inkFace(f) })
      region(img, BOX, 3 * (1 - ease.out3(seg(t, SHUT, SHUT + 0.6))))
    }
    pins(f, 1, 0.75 * (1 - kOut), 2000)
    rim(1)
    ring(1, 1, SP.x, { flare: fl })
    faceBrackets(f, 1, 0.42 * (1 - kOut), 2, SP.x)
    eyeLight(T, 1, SP.x, fl, 0)
    lineA(EYE.x, EYE.y + 40, EYE.x, LC.y - RING - 26, C.celadon, 1, 0.45)
    // S08에서 넘어온 기둥·옆얼굴·계수기는 물러나고, 기둥은 삼정 기둥으로 남는다
    scaleCol(f, 1, 1 - kOut, null, SP.x)
    if (kOut < 1) {
      const P = tmp()
      off(() => profile(f, 2000, 1, P.x), P)
      region(P.c, { x: PROF_X - 40, y: 300, w: 140, h: 900 }, 0, 1 - kOut)
      const Cn = tmp()
      off(() => counter(f, 2000, 1), Cn)
      region(Cn.c, { x: 0, y: 1200, w: W, h: 300 }, 8 * kOut, 1 - kOut)
    }
    const after = cap ? 1 - 0.35 * ease.sine(seg(t, SHUT, SHUT + 0.6)) : 1
    measure(f, t, after, cap ? C.celadonDeep : C.celadon, cap ? undefined : SP.x)
    zoneLabels(f, t, 1)
    readouts(f, t, 1)
    // 채록 표지
    const kC = ease.sine(seg(t, SHUT + 0.15, SHUT + 0.6))
    if (kC > 0) {
      mono('FRAME 01 · 판독 후 즉시 폐기', W - 72, 372, C.ash, 15, 'right', 0.8 * kC)
      // 셔터 파동(금)
      const kw = seg(t, SHUT, SHUT + 0.8)
      if (kw < 1) {
        ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6 * (1 - ease.sine(kw))
        ctx.beginPath(); ctx.arc(LC.x, LC.y, LC.r + 20 + 90 * ease.out3(kw), 0, 6.283); ctx.stroke(); ctx.restore()
      }
    }
    flush(SP)
    const kG = seg(t, 0.25, 0.85)
    const kG2 = seg(t, SHUT + 0.1, SHUT + 0.7)
    guide('빛이 얼굴을 지나갑니다', 1 - kG)
    guide('얼굴의 비례를 재고 있습니다', kG * (1 - kG2))
    guide('형상을 담았습니다', kG2)
    // 부드러운 셔터 섬광: 렌즈 중심에서 번지는 한지빛
    if (fl > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const g = ctx.createRadialGradient(LC.x, LC.y, 0, LC.x, LC.y, 1200)
      g.addColorStop(0, `rgba(255,246,230,${0.92 * fl})`); g.addColorStop(0.3, `rgba(251,242,222,${0.6 * fl})`); g.addColorStop(1, `rgba(241,230,207,${0.12 * fl})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
    vignette(0.6)
    head(3, 4, seg(t, 0, 0.4))
    disclaimer()
  },
}

export const scenes: Scene[] = [S06, S07, S08, S09]
