/**
 * 6막 현시 — S15 빛기둥이 열리다 · S16 진주 흉상 · S17 이름이 맺히다 · S18 두루마리 판독서 · S19 먹으로 거두다
 * S14의 '사유의 방' 침묵(어둠 속 몇 점의 먼지)에서 천장의 앰버 빛이 칼날처럼 내려와 원뿔로 열린다(A).
 * 바닥 빛웅덩이에 고인 진주 가루가 떠올라 흉상이 되고(C), 이름은 유리 물방울과 함께 세로쓰기로 맺힌다(B).
 * 카메라가 아래로 기울면 바닥선이 족자의 천간(天杆)이 되어 한지 판독서가 풀리고, 끝에는 먹이 모든 것을 거둔다.
 * 빛은 선을 긋고, 먹은 번진다. 한 컷에 초점은 하나.
 */
import {
  C, FONT, H, TYPE_COL, W, blackout, clamp, ctx, disclaimer, drawBlur, droplet, dust, ease, face, hair, hanji, header,
  layer, lerp, mono, rng, seal, seg, setCtx, text, tmp, vignette, type Scene,
} from '../engine'
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { WIN } from './act1'

type Ctx = CanvasRenderingContext2D
type Lyr = { c: HTMLCanvasElement; x: Ctx }

const ACT = '현시'
/** 장면 전역 시각 — 먼지·반짝임이 컷에서 끊기지 않게 */
const T0 = { S15: 0, S16: 2.5, S17: 6.5, S18: 12, S19: 18 }
const HEAD_L = '墨光判讀室 · INK-LIGHT READING ROOM'
const HEAD_R = '顯示 · REVEAL'

/* ───── 이 막에서 쓰는 글자 묶음을 미리 불러 둔다(첫 스틸부터 대체 글꼴이 섞이지 않게) ───── */
const GLYPHS = '顯示傾向臟腑養生參考用根據判讀書墨光室觀形太陰人少陽少陰太陽肺脾肝腎大小 결과는저장되지않았습니다감사합니다태음인경향소양소음태양판별제외판정일치도가아닌모델확신도전문가진단일치율연구상이론도식문헌지지설문턱폭땀생활제안근거기여내는유산소운동저녁과식줄이기무도라지율무아침햇빛산책체질 Taeeum-in constitutional tendency REFERENCE ONLY INK-LIGHT READING ROOM REVEAL BMI 0123456789%·~+.'
try {
  await Promise.race([
    Promise.all(
      [`200 40px ${FONT.serif}`, `400 40px ${FONT.serif}`, `900 40px ${FONT.serif}`, `300 40px ${FONT.hahmlet}`, `400 40px ${FONT.sans}`,
        `500 40px ${FONT.sans}`, `italic 300 40px ${FONT.italic}`, `300 20px ${FONT.mono}`].map((f) => document.fonts.load(f, GLYPHS)),
    ),
    new Promise((r) => setTimeout(r, 5000)),
  ])
} catch { /* 미리 불러오기 실패는 무시: 러너가 다시 시도한다 */ }

/* ───────── 로컬 도우미 ───────── */
function onLayer(fn: () => void, L: Lyr = tmp()) {
  const m = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(m) }
  return L
}
/** 부분 영역만(흐림을 걸어) 옮겨 그린다 — 전체 화면 블러보다 싸다 */
function region(src: HTMLCanvasElement, x: number, y: number, w: number, h: number, blur = 0, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0.002) return
  const pad = Math.ceil(blur * 3) + 2
  const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad))
  const x1 = Math.min(W, Math.ceil(x + w + pad)), y1 = Math.min(H, Math.ceil(y + h + pad))
  if (x1 <= x0 || y1 <= y0) return
  ctx.save()
  ctx.globalAlpha = clamp(alpha)
  ctx.globalCompositeOperation = op
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}
function lineA(x0: number, y0: number, x1: number, y1: number, color: string, w: number, alpha: number) {
  if (alpha > 0.003) hair(x0, y0, x1, y1, color, w, alpha)
}
function textW(s: string, font: string, spacing = 0) {
  ctx.save(); ctx.font = font; ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(s).width
  ctx.restore()
  return w
}
function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, k))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}
/** 글자별로 먹이 맺히듯(흐림→선명) 나타나는 가로 텍스트 */
function revealText(s: string, x: number, y: number, font: string, color: string, k: number,
  o: { align?: 'left' | 'center' | 'right'; spacing?: number; alpha?: number; stagger?: number } = {}) {
  const alpha = o.alpha ?? 1
  if (k <= 0 || alpha <= 0) return
  const sp = o.spacing ?? 0
  ctx.save(); ctx.font = font; ctx.letterSpacing = '0px'
  const chars = [...s]
  const ws = chars.map((ch) => ctx.measureText(ch).width)
  ctx.restore()
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)
  let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x
  const n = chars.length
  const st = o.stagger ?? Math.min(0.12, 0.9 / n)
  chars.forEach((ch, i) => {
    const kk = k >= 1 ? 1 : clamp(k * (1 + (n - 1) * st) - i * st)
    if (ch !== ' ' && kk > 0) text(ch, xx, y, font, color, { alpha: ease.sine(kk) * alpha, blur: (1 - ease.out3(kk)) * 8 })
    xx += ws[i] + sp
  })
}

/* ───────── 카메라 ───────── */
type Cam = { sc: number; tx: number; ty: number }
const PIV = { x: 540, y: 900 }
function withCam(c: Cam, fn: () => void) {
  ctx.save()
  ctx.translate(PIV.x + c.tx, PIV.y + c.ty); ctx.scale(c.sc, c.sc); ctx.translate(-PIV.x, -PIV.y)
  fn()
  ctx.restore()
}

/* ───────── 빛기둥(A): 천장 광원 → 바닥 빛웅덩이 ───────── */
const BM = { cx: 540, topW: 120, botW: 980, h: 1640 }
const FLOOR = BM.h
/** 원뿔 꼭짓점(화면 위 밖) — 빛살이 여기서 방사한다 */
const APEX = (-BM.topW * BM.h) / (BM.botW - BM.topW)
const beamHalf = (y: number) => (BM.topW + (BM.botW - BM.topW) * clamp(y / BM.h)) / 2

let beamC: HTMLCanvasElement | null = null
function beamCache() {
  if (beamC) return beamC
  const P = layer(), S = layer()
  const trap = (x: Ctx, wf: number, a: number) => {
    const g = x.createLinearGradient(0, 0, 0, BM.h)
    g.addColorStop(0, `rgba(255,220,164,${a})`)
    g.addColorStop(0.1, `rgba(246,192,116,${a * 0.6})`)
    g.addColorStop(0.32, `rgba(232,166,75,${a * 0.3})`)
    g.addColorStop(0.7, `rgba(232,166,75,${a * 0.17})`)
    g.addColorStop(1, `rgba(232,166,75,${a * 0.15})`)
    x.fillStyle = g
    x.beginPath()
    x.moveTo(BM.cx - (BM.topW / 2) * wf, 0); x.lineTo(BM.cx + (BM.topW / 2) * wf, 0)
    x.lineTo(BM.cx + (BM.botW / 2) * wf, BM.h); x.lineTo(BM.cx - (BM.botW / 2) * wf, BM.h)
    x.closePath(); x.fill()
  }
  for (const [wf, a] of [[1.08, 0.19], [0.8, 0.18], [0.55, 0.17], [0.3, 0.15]] as const) trap(S.x, wf, a)
  P.x.filter = 'blur(40px)'
  P.x.drawImage(S.c, 0, 0)
  S.x.clearRect(0, 0, W, H)
  trap(S.x, 1.0, 0.1)
  P.x.filter = 'blur(9px)'
  P.x.globalCompositeOperation = 'lighter'
  P.x.drawImage(S.c, 0, 0)
  P.x.filter = 'none'
  const g = P.x.createRadialGradient(BM.cx, -24, 0, BM.cx, -24, 300)
  g.addColorStop(0, 'rgba(255,230,180,0.6)'); g.addColorStop(0.35, 'rgba(255,200,120,0.16)'); g.addColorStop(1, 'rgba(255,200,120,0)')
  P.x.fillStyle = g
  P.x.fillRect(0, 0, W, 340)
  beamC = P.c
  return beamC
}
const raysC: HTMLCanvasElement[] = []
/** 갓 레이: 꼭짓점에서 방사하는 가는 빛살(두 벌을 교차 페이드해 일렁이게) */
function raysCache(i: number) {
  if (raysC[i]) return raysC[i]
  const P = layer(), S = layer()
  const r = rng(71 + i * 13)
  const maxA = Math.atan(BM.botW / 2 / (BM.h - APEX))
  const xAt = (a: number, y: number) => BM.cx + Math.tan(a) * (y - APEX)
  for (let j = 0; j < 16; j++) {
    const a = (r() * 2 - 1) * maxA * 0.9, da = 0.003 + r() * 0.012, al = 0.05 + r() * 0.09
    const g = S.x.createLinearGradient(0, 0, 0, BM.h)
    g.addColorStop(0, `rgba(255,226,176,${al})`); g.addColorStop(0.4, `rgba(244,186,110,${al * 0.42})`); g.addColorStop(1, `rgba(232,166,75,${al * 0.2})`)
    S.x.fillStyle = g
    S.x.beginPath()
    S.x.moveTo(xAt(a - da, 0), 0); S.x.lineTo(xAt(a + da, 0), 0); S.x.lineTo(xAt(a + da, BM.h), BM.h); S.x.lineTo(xAt(a - da, BM.h), BM.h)
    S.x.closePath(); S.x.fill()
  }
  P.x.filter = 'blur(6px)'
  P.x.drawImage(S.c, 0, 0)
  raysC[i] = P.c
  return P.c
}
let floorC: HTMLCanvasElement | null = null
/** 바닥 빛웅덩이 + 바닥면 산란 */
function floorCache() {
  if (floorC) return floorC
  const P = layer(), S = layer()
  const R = (BM.botW / 2) * 1.05
  S.x.save()
  S.x.translate(BM.cx, FLOOR); S.x.scale(1, 0.085)
  const g = S.x.createRadialGradient(0, 0, 0, 0, 0, R)
  g.addColorStop(0, 'rgba(255,230,184,0.75)'); g.addColorStop(0.45, 'rgba(246,190,114,0.38)'); g.addColorStop(0.82, 'rgba(232,166,75,0.12)'); g.addColorStop(1, 'rgba(232,166,75,0)')
  S.x.fillStyle = g
  S.x.beginPath(); S.x.arc(0, 0, R, 0, 6.283); S.x.fill()
  S.x.restore()
  S.x.save()
  S.x.translate(BM.cx, FLOOR + 10); S.x.scale(1, 0.32)
  const g2 = S.x.createRadialGradient(0, 0, 0, 0, 0, R * 1.25)
  g2.addColorStop(0, 'rgba(232,166,75,0.1)'); g2.addColorStop(1, 'rgba(232,166,75,0)')
  S.x.fillStyle = g2
  S.x.beginPath(); S.x.arc(0, 0, R * 1.25, 0, 6.283); S.x.fill()
  S.x.restore()
  P.x.filter = 'blur(7px)'
  P.x.drawImage(S.c, 0, 0)
  floorC = P.c
  return P.c
}
/** 빛기둥: open(가로 열림 0→1), descent(위에서 내려옴 0→1) */
function beamFx(k: number, T: number, open = 1, descent = 1) {
  if (k <= 0) return
  const L = tmp()
  const o = Math.max(0.018, open)
  L.x.save()
  L.x.translate(BM.cx, 0); L.x.scale(o, 1); L.x.translate(-BM.cx, 0)
  L.x.drawImage(beamCache(), 0, 0)
  L.x.globalCompositeOperation = 'lighter'
  L.x.globalAlpha = 0.55 + 0.45 * Math.sin(T * 0.8)
  L.x.drawImage(raysCache(0), 0, 0)
  L.x.globalAlpha = 0.55 + 0.45 * Math.sin(T * 0.57 + 2.1)
  L.x.drawImage(raysCache(1), 0, 0)
  L.x.restore()
  if (descent < 1) {
    L.x.globalCompositeOperation = 'destination-in'
    const cut = lerp(-80, BM.h + 300, descent)
    const g = L.x.createLinearGradient(0, cut - 360, 0, cut)
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    L.x.fillStyle = g
    L.x.fillRect(0, 0, W, H)
    L.x.globalCompositeOperation = 'source-over'
  }
  drawBlur(L.c, 0, k, 'screen')
}
/** 빛의 칼날: 원뿔이 열리기 전, 광원에서 바닥까지 한 줄 빛이 그어진다 */
function bladeFx(k: number, descent: number) {
  if (k <= 0 || descent <= 0) return
  const L = tmp()
  const h = Math.max(2, (FLOOR + 6) * descent)
  const g = L.x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,244,220,1)'); g.addColorStop(0.75, 'rgba(255,214,150,0.75)'); g.addColorStop(1, 'rgba(255,214,150,0)')
  L.x.fillStyle = g
  L.x.beginPath()
  L.x.moveTo(BM.cx - 1, 0); L.x.lineTo(BM.cx + 1, 0); L.x.lineTo(BM.cx + 2.6, h); L.x.lineTo(BM.cx - 2.6, h)
  L.x.closePath(); L.x.fill()
  region(L.c, BM.cx - 8, 0, 16, h, 0, k * 0.9, 'lighter')
  region(L.c, BM.cx - 8, 0, 16, h, 5, k, 'lighter')
  region(L.c, BM.cx - 8, 0, 16, h, 22, k * 0.8, 'lighter')
}
function floorFx(k: number, open = 1) {
  if (k <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = clamp(k)
  ctx.translate(BM.cx, 0); ctx.scale(Math.max(0.02, open), 1); ctx.translate(-BM.cx, 0)
  ctx.drawImage(floorCache(), 0, 0)
  ctx.restore()
}
/** 바닥선: 빛이 닿은 자리에서 양쪽으로 그어지는 금니 실선과 청자 눈금 */
function floorLine(k: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const hw = (W / 2 - 64) * ease.out3(k)
  ctx.save()
  const g = ctx.createLinearGradient(BM.cx - hw, 0, BM.cx + hw, 0)
  g.addColorStop(0, 'rgba(210,185,138,0)'); g.addColorStop(0.5, `rgba(255,226,170,${0.85 * alpha})`); g.addColorStop(1, 'rgba(210,185,138,0)')
  ctx.strokeStyle = g
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(BM.cx - hw, FLOOR + 0.5); ctx.lineTo(BM.cx + hw, FLOOR + 0.5); ctx.stroke()
  ctx.restore()
  for (let i = -12; i <= 12; i++) {
    const x = BM.cx + i * 38
    const d = Math.abs(x - BM.cx)
    if (d > hw) continue
    const major = i % 4 === 0
    lineA(x, FLOOR + 6, x, FLOOR + (major ? 18 : 11), C.celadon, 1, alpha * (major ? 0.42 : 0.24) * (1 - d / (W / 2)))
  }
  if (k < 1) {
    // 선의 머리에 맺힌 불꽃
    const L = tmp()
    for (const s of [-1, 1]) {
      L.x.fillStyle = 'rgba(255,236,200,1)'
      L.x.beginPath(); L.x.arc(BM.cx + s * hw, FLOOR, 2.2, 0, 6.283); L.x.fill()
    }
    region(L.c, 0, FLOOR - 40, W, 80, 0, alpha)
    region(L.c, 0, FLOOR - 40, W, 80, 8, alpha, 'lighter')
  }
}
/** 광원 반짝임(애너모픽 수평 플레어) */
function sourceGlint(k: number) {
  if (k <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const g = ctx.createRadialGradient(BM.cx, 4, 0, BM.cx, 4, 170)
  g.addColorStop(0, `rgba(255,238,206,${0.95 * k})`); g.addColorStop(0.1, `rgba(255,214,150,${0.4 * k})`); g.addColorStop(1, 'rgba(255,214,150,0)')
  ctx.fillStyle = g
  ctx.fillRect(BM.cx - 180, 0, 360, 190)
  const s = ctx.createLinearGradient(BM.cx - 460, 0, BM.cx + 460, 0)
  s.addColorStop(0, 'rgba(255,200,130,0)'); s.addColorStop(0.5, `rgba(255,228,186,${0.6 * k})`); s.addColorStop(1, 'rgba(255,200,130,0)')
  ctx.fillStyle = s
  ctx.fillRect(BM.cx - 460, 3, 920, 2.5)
  ctx.restore()
}
/**
 * 어둠 속 몇 점의 티끌 — S14(5막 끝, '사유의 방' 침묵)의 티끌을 같은 시드·같은 궤적으로 이어받는다(컷이 보이지 않게).
 * T는 이 막의 전역 시각(S15 시작 = 0) → S14 안의 시각으로는 3 + T. 빛기둥 안에 들어온 티끌은 밝아진다.
 */
const MOTE_P0 = { x: 540, y: 760 }
function motes(T: number, alpha: number, open = 0) {
  if (alpha <= 0) return
  const t14 = 3 + T, TT = 8.5 + t14
  const r = rng(303)
  const L = tmp()
  for (let i = 0; i < 9; i++) {
    const x0 = MOTE_P0.x + (r() - 0.5) * 760, y0 = MOTE_P0.y + (r() - 0.5) * 900
    const sp = 9 + r() * 12, ph = r() * 6.283, rr = r() < 0.4 ? 1.4 + r() : 5 + r() * 9
    const x = x0 + Math.sin(TT * 0.3 + ph) * 26, y = y0 - t14 * sp + 20
    const inB = open > 0 ? clamp((beamHalf(y) * open - Math.abs(x - BM.cx)) / 60 + 0.5) : 0
    const al = (rr > 3 ? 0.1 + r() * 0.08 : 0.35 + r() * 0.3) * alpha * (0.7 + 0.3 * Math.sin(TT * 1.4 + ph * 3)) * (1 + inB * 0.8)
    const g = L.x.createRadialGradient(x, y, 0, x, y, rr)
    g.addColorStop(0, `rgba(255,214,150,${al})`); g.addColorStop(0.75, `rgba(255,214,150,${al * 0.7})`); g.addColorStop(1, 'rgba(255,214,150,0)')
    L.x.fillStyle = g; L.x.beginPath(); L.x.arc(x, y, rr, 0, 6.283); L.x.fill()
  }
  region(L.c, 60, 200, W - 120, 1300, 1.2, 1)
  region(L.c, 60, 200, W - 120, 1300, 6, 0.6, 'lighter')
}
/** S14 끝의 티끌 밝기(0.65)에서 빛이 열리며 잦아든다 */
const moteA15 = (t: number) => 0.65 * (1 - 0.45 * ease.sine(seg(t, 0.8, 2.5)))
/** 빛기둥 속 먼지 */
function dustFx(T: number, alpha: number, open = 1) {
  if (alpha <= 0) return
  dust(BM.cx, BM.topW * 0.85, BM.botW * 0.9 * Math.max(0.05, open), FLOOR - 10, 720, T, 5, '255,214,150', alpha)
}

/* ───────── 배경 보케(C) ───────── */
let bokC: HTMLCanvasElement | null = null
function bokehCache() {
  if (bokC) return bokC
  const P = layer(), S = layer()
  const r = rng(97)
  const tints = ['255,214,150', '243,238,229', '210,185,138', '255,226,180', '127,191,152']
  for (let i = 0; i < 24; i++) {
    let x = r() * W
    const y = 150 + r() * 1420
    const rr = 22 + r() ** 2 * 120
    if (Math.abs(x - 540) < 300 && y < 1500) x = x < 540 ? x - 330 : x + 330
    const tint = tints[i % 5], a = 0.025 + r() * 0.045
    S.x.fillStyle = `rgba(${tint},${a})`
    S.x.beginPath(); S.x.arc(x, y, rr, 0, 6.283); S.x.fill()
    S.x.strokeStyle = `rgba(${tint},${a * 1.6})`
    S.x.lineWidth = 1.5
    S.x.stroke()
  }
  P.x.filter = 'blur(4px)'
  P.x.drawImage(S.c, 0, 0)
  bokC = P.c
  return P.c
}
function bokehFx(alpha: number, T: number, dx = 0, dy = 0) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(alpha)
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(bokehCache(), Math.sin(T * 0.11) * 12 + dx, Math.cos(T * 0.09) * 9 + dy)
  ctx.restore()
}

/* ───────── 진주 입자 흉상(C) ───────── */
interface BP { x: number; y: number; s: number; e: number; r: number; h1: number; h2: number; h3: number; rim: number; fade: number }
interface Bust { pts: BP[]; top: number; eyeY: number; chin: number }
const BX = 540, BY = 690, BW = 410
let bustC: Bust | null = null
const gauss = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy))
/** 천장 단일 광원(위·약간 앞·왼쪽) */
const LGT = (() => { const v = [-0.16, -0.75, 0.64], n = Math.hypot(...v); return v.map((c) => c / n) })()
/**
 * 진주 흉상 — 깊이 정보가 없으므로 얼굴 랜드마크 위에 높이장(가우시안 부조: 이마·눈두덩·콧등·광대·입술·턱)을 세우고
 * 그 기울기로 법선을 구해 천장 광원에 대한 램버트 밝기를 계산한다. 입자는 밝기에 비례해 남기므로(어두운 곳은 성글다)
 * 윤곽선 없이 빛과 그늘만으로 형태가 읽힌다. 표정은 데모 얼굴의 웃음 대신, 사유의 방 반가사유상처럼 눈을 내리깐 담담한 얼굴.
 */
function bust(): Bust {
  if (bustC) return bustC
  const f = face(BX, BY, BW)
  const lm = f.lm
  const r = rng(808)
  const pts: BP[] = []
  const add = (x: number, y: number, s: number, e: number, rim: number, fade = 1) => { pts.push({ x, y, s, e, r: r(), h1: r(), h2: r(), h3: r(), rim, fade }) }
  const w2 = BW / 2
  const fcx = (lm[234].x + lm[454].x) / 2
  const eye = (o: number, i: number) => {
    const x = (lm[o].x + lm[i].x) / 2
    return { x, y: (lm[o].y + lm[i].y) / 2, hw: Math.abs(lm[o].x - lm[i].x) / 2, sg: Math.sign(x - fcx) }
  }
  const eyes = [eye(33, 133), eye(263, 362)]
  const nx0 = lm[4].x, tipY = lm[1].y, brY = lm[168].y, baseY = lm[2].y, wing = Math.abs(lm[98].x - lm[327].x) / 2
  // 입: 웃는 데모 입 대신 좁고 평평한 입(입꼬리가 살짝 내려간 담담한 선)
  const mo = { x: lm[0].x, y: (lm[13].y + lm[14].y) / 2, hw: (Math.abs(lm[291].x - lm[61].x) / 2) * 0.74 }
  const chin = lm[152].y
  const bumps: number[][] = [
    [nx0, lm[10].y + 45, w2 * 0.8, 60, 5], // 이마
    [nx0, eyes[0].y - 44, 20, 17, 6], // 미간
    [nx0, (brY + tipY) / 2, 13, (tipY - brY) * 0.5, 26], // 콧등
    [nx0, tipY - 8, 21, 17, 20], // 코끝
    [nx0 - wing * 0.8, baseY - 14, 15, 12, 11], [nx0 + wing * 0.8, baseY - 14, 15, 12, 11], // 콧방울
    [mo.x, mo.y - 2, mo.hw * 1.3, 46, 4], // 입 둘레
    [mo.x, mo.y - 7, mo.hw * 0.78, 7, 4], // 윗입술
    [mo.x, mo.y + 13, mo.hw * 0.62, 9, 6], // 아랫입술
    [mo.x, mo.y + 34, mo.hw * 0.62, 8, -6], // 턱입술 고랑
    [mo.x, lerp(mo.y, chin, 0.6), 54, 36, 15], // 턱끝
  ]
  for (const e of eyes) {
    bumps.push([e.x + e.sg * 4, e.y - 46, e.hw * 1.5, 15, 12]) // 눈썹뼈
    bumps.push([e.x, e.y - 4, e.hw * 1.1, 22, -11]) // 눈두덩 오목
    bumps.push([e.x, e.y - 2, e.hw * 0.85, 12, 9]) // 눈꺼풀(안구)
    bumps.push([e.x + e.sg * e.hw * 0.45, e.y + 72, e.hw * 1.3, 34, 13]) // 광대
    bumps.push([e.x + e.sg * e.hw * 1.9, e.y - 70, 26, 46, -7]) // 관자놀이
  }
  const oval = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.map((e) => [lm[e.start], lm[e.end]] as const)
  const brows = [[107, 66, 105, 63, 70], [336, 296, 334, 293, 300]].map((ids) => ids.map((i) => lm[i]))
  const distPoly = (x: number, y: number, P: { x: number; y: number }[]) => {
    let best = 1e9
    for (let i = 0; i < P.length - 1; i++) {
      const A = P[i], B = P[i + 1], vx = B.x - A.x, vy = B.y - A.y
      const t = clamp(((x - A.x) * vx + (y - A.y) * vy) / (vx * vx + vy * vy))
      best = Math.min(best, Math.hypot(x - A.x - vx * t, y - A.y - vy * t))
    }
    return best
  }
  /** 얼굴 면의 밝기 [밝기, 림]; 밝기 -1 = 파낸 선(입술 사이 · 내리깐 눈꺼풀 선) */
  const light = (x: number, y: number): [number, number] => {
    const u = (x - fcx) / f.rx, v = (y - f.cy) / f.ry
    let nxv = u * (0.25 + 2.0 * u * u), nyv = v * (0.25 + 1.1 * v * v)
    for (const [x0, y0, sx, sy, a] of bumps) {
      const dx = x - x0, dy = y - y0
      const g = a * Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy))
      nxv += ((2 * dx) / (sx * sx)) * g
      nyv += ((2 * dy) / (sy * sy)) * g
    }
    const d = clamp(((LGT[0] * nxv + LGT[1] * nyv + LGT[2]) / Math.hypot(nxv, nyv, 1) + 0.12) / 1.12)
    let occ = 1
    for (const e of eyes) occ *= 1 - 0.36 * gauss(x - e.x, y - (e.y - 10), e.hw * 1.0, 12) // 눈썹뼈 그늘
    occ *= 1 - 0.55 * gauss(x - nx0, y - (baseY + 10), wing * 1.25, 10) // 코 밑 그늘
    occ *= 1 - 0.35 * gauss(x - mo.x, y - (mo.y + 30), mo.hw * 0.6, 8) // 아랫입술 밑 그늘
    for (const sg of [-1, 1]) occ *= 1 - 0.6 * gauss(x - (nx0 + sg * wing * 0.42), y - (baseY - 5), 7, 4) // 콧구멍
    const xm = (x - mo.x) / mo.hw
    if (Math.abs(xm) < 1) {
      const dd = Math.abs(y - (mo.y + 2.5 * xm * xm)), wq = 1 - xm ** 4
      if (dd < 1.5 * wq) return [-1, 0]
      occ *= 1 - 0.55 * wq * (1 - clamp(dd / 6))
    }
    for (const e of eyes) {
      const xe = (x - e.x) / e.hw
      if (Math.abs(xe) < 1.08) {
        const dd = y - (e.y + 3 - 4.5 * (1 - xe * xe))
        if (Math.abs(dd) < 1.5 * (1 - Math.min(1, xe ** 4)) + 0.25) return [-1, 0]
        if (dd > 0 && dd < 6) occ *= 0.68 + (0.32 * dd) / 6 // 속눈썹 그늘
      }
    }
    for (const P of brows) { const dd = distPoly(x, y, P); if (dd < 7) occ *= 0.74 + 0.26 * (dd / 7) }
    let dOv = 1e9
    for (const [A, B] of oval) {
      const vx = B.x - A.x, vy = B.y - A.y
      const t = clamp(((x - A.x) * vx + (y - A.y) * vy) / (vx * vx + vy * vy || 1))
      dOv = Math.min(dOv, Math.hypot(x - A.x - vx * t, y - A.y - vy * t))
    }
    // 역광 림: 실루엣에서 14px 안쪽, 광대~턱선 쪽에서만(관자놀이·이마는 제외)
    const rim = clamp(1 - dOv / 12) * clamp((Math.abs(u) - 0.45) / 0.3) * clamp((v + 0.35) / 0.35)
    // 이마 꼭대기는 한 단 낮추고, 머리선(메시 윗변)은 두개 쪽으로 풀어 헬멧 선이 생기지 않게
    const top = (1 - 0.32 * clamp((-v - 0.42) / 0.4)) * (v < -0.45 ? 0.35 + 0.65 * clamp(dOv / 34) : 1)
    return [d * occ * top, rim]
  }
  const surf = (x: number, y: number) => {
    const [b, rim] = light(x, y)
    if (b < 0 || r() > 0.08 + 0.92 * Math.max(clamp(b * 1.1) ** 1.3, rim * 0.7)) return
    add(x, y, Math.min(1.1, b * (1 - rim * 0.3) + rim * 0.46), 0, rim > 0.45 ? 1 : 0, 1)
  }
  // 얼굴 면: 테셀레이션을 점유 격자로 래스터화한 뒤 그 안을 고르게 채운다.
  // (입을 닫느라 접힌 입술 삼각형이 겹쳐 밀도가 두 배가 되면 밝은 '웃음 띠'가 생기므로, 겹침을 격자로 없앤다)
  const CS = 2
  const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y)
  const gx0 = Math.floor(Math.min(...xs)) - 4, gy0 = Math.floor(Math.min(...ys)) - 4
  const GW = Math.ceil((Math.max(...xs) - gx0 + 8) / CS), GH = Math.ceil((Math.max(...ys) - gy0 + 8) / CS)
  const occG = new Uint8Array(GW * GH)
  const mark = (cx: number, cy: number) => { if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) occG[cy * GW + cx] = 1 }
  const tri = (A: { x: number; y: number }, B: { x: number; y: number }, Cc: { x: number; y: number }) => {
    const minX = Math.floor((Math.min(A.x, B.x, Cc.x) - gx0) / CS), maxX = Math.ceil((Math.max(A.x, B.x, Cc.x) - gx0) / CS)
    const minY = Math.floor((Math.min(A.y, B.y, Cc.y) - gy0) / CS), maxY = Math.ceil((Math.max(A.y, B.y, Cc.y) - gy0) / CS)
    const sgn = (P: { x: number; y: number }, Q: { x: number; y: number }, x: number, y: number) => (Q.x - P.x) * (y - P.y) - (Q.y - P.y) * (x - P.x)
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const x = gx0 + (cx + 0.5) * CS, y = gy0 + (cy + 0.5) * CS
      const d1 = sgn(A, B, x, y), d2 = sgn(B, Cc, x, y), d3 = sgn(Cc, A, x, y)
      const neg = d1 < -0.5 || d2 < -0.5 || d3 < -0.5, pos = d1 > 0.5 || d2 > 0.5 || d3 > 0.5
      if (!(neg && pos)) mark(cx, cy)
    }
  }
  const adj = new Map<number, Set<number>>()
  for (const e of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    if (!adj.has(e.start)) adj.set(e.start, new Set())
    if (!adj.has(e.end)) adj.set(e.end, new Set())
    adj.get(e.start)!.add(e.end); adj.get(e.end)!.add(e.start)
  }
  for (const e of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    for (const c of adj.get(e.start)!) if (adj.get(e.end)!.has(c)) tri(lm[e.start], lm[e.end], lm[c])
  }
  // 눈구멍(메시에 없는 자리)도 덮는다 — 눈은 내리감았다
  for (const e of eyes) {
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      const x = gx0 + (cx + 0.5) * CS, y = gy0 + (cy + 0.5) * CS
      if (((x - e.x) / (e.hw * 1.02)) ** 2 + ((y - e.y) / 11) ** 2 < 1) occG[cy * GW + cx] = 1
    }
  }
  const dens = 0.24 // 후보 입자 / px² (밝기에 따라 다시 솎는다)
  const M = Math.round(GW * GH * CS * CS * dens)
  for (let i = 0; i < M; i++) {
    const x = gx0 + r() * GW * CS, y = gy0 + r() * GH * CS
    if (occG[Math.floor((y - gy0) / CS) * GW + Math.floor((x - gx0) / CS)]) surf(x, y)
  }
  const inFace = (x: number, y: number, m = 1) => ((x - f.cx) / (f.rx * m)) ** 2 + ((y - f.cy) / (f.ry * m)) ** 2 < 1
  // 얼굴 가장자리: 옆면과 턱선에만 역광 림(석록으로 물든다). 이마 위는 두개로 이어지므로 선을 두지 않는다
  for (const e of FaceLandmarker.FACE_LANDMARKS_FACE_OVAL) {
    const A = lm[e.start], B = lm[e.end]
    for (let i = 0; i < 12; i++) {
      const t = i / 12, x = lerp(A.x, B.x, t) + (r() - 0.5) * 3, y = lerp(A.y, B.y, t) + (r() - 0.5) * 3
      const u = (x - fcx) / f.rx, v = (y - f.cy) / f.ry
      const k = Math.max(clamp((Math.abs(u) - 0.5) / 0.4), clamp((v - 0.55) / 0.35) * 0.45) * clamp((y - lm[9].y + 20) / 60)
      if (k < 0.05) continue
      add(x, y, 0.3 + 0.45 * k, 0.35, 1, k)
    }
  }
  // 두개: 위에서 빛을 받는 돔(정수리가 밝지만 얼굴보다 한 단 낮춘다)
  const lt = lm[234], rt = lm[454]
  const ccx = (lt.x + rt.x) / 2, ccy = (lt.y + rt.y) / 2
  const crx = (Math.abs(rt.x - lt.x) / 2) * 1.04
  const cry = ccy - lm[10].y + 0.3 * w2
  for (let i = 0; i < 6400; i++) {
    const u = r() * 2 - 1, v = r()
    if (u * u + v * v > 1) continue
    const x = ccx + u * crx, y = ccy - v * cry
    if (inFace(x, y, 0.985)) continue
    const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v))
    const d = clamp((LGT[0] * u - LGT[1] * v + LGT[2] * nz + 0.12) / 1.12)
    const rim = clamp((Math.hypot(u, v) - 0.9) / 0.1) * clamp((Math.abs(u) - 0.6) / 0.3)
    if (r() > 0.1 + 0.9 * d) continue
    add(x + (r() - 0.5) * 1.2, y + (r() - 0.5) * 1.2, d * 0.72 + rim * 0.3, 0, rim > 0.5 ? 1 : 0, 0.66)
  }
  // 목·어깨: 윤곽은 성글고 흐리게(마네킹 선처럼 보이지 않게), 어깨 윗면이 빛을 받는다
  const U = (u: number) => BX + u * w2, V = (v: number) => chin + v * w2
  const fadeV = (v: number) => clamp(1 - (v - 1.0) / 1.1)
  const curve = (p0: number[], c: number[], p1: number[], n: number, s: number, e: number, rim: number, fade = 1) => {
    for (const sg of [-1, 1]) for (let i = 0; i < n; i++) {
      const t = i / (n - 1), mt = 1 - t
      const u = mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0]
      const v = mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1]
      if (r() < 0.25) continue
      add(U(sg * u) + (r() - 0.5) * 3, V(v) + (r() - 0.5) * 3, s, e, rim, fadeV(v) * fade)
    }
  }
  curve([0.6, -0.22], [0.56, 0.1], [0.62, 0.38], 60, 0.26, 0.35, 1, 0.7) // 목 옆선
  curve([0.62, 0.38], [0.8, 0.76], [1.42, 0.86], 110, 0.55, 0.45, 1) // 승모근
  curve([1.42, 0.86], [1.76, 0.9], [1.82, 1.36], 80, 0.5, 0.45, 1) // 어깨
  curve([1.82, 1.36], [1.88, 1.8], [1.9, 2.3], 70, 0.34, 0.4, 1, 0.8) // 팔
  curve([0.1, 0.98], [0.6, 1.06], [1.14, 0.9], 80, 0.42, 0.25, 0, 0.6) // 쇄골
  const halfW = (v: number) => (v < 0.38 ? 0.6 : v < 0.86 ? lerp(0.62, 1.42, ease.sine((v - 0.38) / 0.48)) : v < 1.36 ? lerp(1.42, 1.82, Math.sqrt((v - 0.86) / 0.5)) : 1.86)
  /** |u|에서 실루엣 윗면의 v (위에서 빛을 받는 면) */
  const vTop = (au: number) => { let v = -0.22; while (v < 2.3 && halfW(v) < au) v += 0.01; return v }
  for (let i = 0; i < 17000; i++) {
    const v = -0.22 + r() * 2.5, u = (r() * 2 - 1) * halfW(v)
    const x = U(u), y = V(v)
    if (inFace(x, y)) continue
    if (r() > 1.15 - v * 0.3) continue
    const au = Math.abs(u)
    let s: number
    if (au < 0.6 && v < 0.4) s = (0.06 + 0.3 * clamp((v + 0.1) / 0.5)) * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - (au / 0.6) ** 2))) // 턱 아래 그늘
    else s = 0.24 + 0.7 * clamp(1 - (v - vTop(au)) / 0.46) * (au > 0.6 ? 1 : 0.72) // 어깨 윗면이 빛을 받는다
    if (r() > 0.25 + 0.75 * clamp(s * 1.4)) continue
    add(x, y, s, 0, 0, fadeV(v))
  }
  bustC = { pts, top: ccy - cry, eyeY: (lm[33].y + lm[263].y) / 2, chin }
  return bustC
}
interface BustO { T: number; gather?: number; focusY?: number; rim?: number; alpha?: number; glow?: number; rest?: number }
const PEARL = '#F3EEE5'
/** 진주 흉상. gather 0→1: 바닥 빛웅덩이에서 떠올라 모인다(어깨부터, 정수리가 마지막). focusY: 얕은 심도의 초점면 */
function drawBust(o: BustO) {
  const b = bust()
  const g = o.gather ?? 1, alpha = o.alpha ?? 1, rimK = o.rim ?? 0, rest = o.rest ?? 0
  const fy = o.focusY ?? b.eyeY
  const L = tmp(), B = tmp()
  const lx = L.x, bx = B.x
  const rc = mixHex(PEARL, '#5FA47C', 0.88 * rimK)
  for (const p of b.pts) {
    let x = p.x, y = p.y, fl = 0, aIn = 1
    if (g < 1) {
      const ny = clamp((FLOOR - p.y) / (FLOOR - b.top))
      const d = clamp((g - 0.56 * ny - 0.16 * p.h1) / 0.28)
      const ang = p.h2 * 6.283, rad = Math.sqrt(p.h3)
      const sx = BX + Math.cos(ang) * rad * 400, sy = FLOOR - 3 + Math.sin(ang) * rad * 30
      if (d <= 0) {
        if (rest > 0 && p.r < 0.22) {
          const tw = 0.5 + 0.5 * Math.sin(o.T * 2.1 + p.h1 * 60)
          lx.fillStyle = PEARL
          lx.globalAlpha = rest * (0.1 + 0.34 * tw * tw) * (1 - rad * 0.5)
          lx.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4)
        }
        continue
      }
      fl = Math.sin(d * Math.PI)
      x = lerp(sx, p.x, ease.sine(d)) + fl * (p.h1 - 0.5) * 170
      y = lerp(sy, p.y, ease.inOut3(d))
      aIn = p.r < 0.22 ? 1 : clamp(d * 5)
    }
    const lb = 0.5 + 0.5 * clamp((beamHalf(y) - Math.abs(x - BM.cx)) / 90 + 0.4)
    // 위에서 떨어지는 단일 광원: 이마·콧등이 밝고 턱 아래로 식는다
    const lt = y < b.chin ? lerp(1.06, 0.9, clamp((y - b.top) / (b.chin - b.top))) : 0.85
    // 면은 대비를 높여(감마) 부조가 읽히게, 윤곽은 고르게
    const base = p.e > 0 ? 0.08 + p.s * 0.5 + p.e * 0.14 : 0.02 + 1.08 * Math.pow(p.s, 1.65)
    const a = Math.min(1, base) * alpha * p.fade * aIn * lb * lt
    if (a <= 0.01) continue
    // 진주광: 일부 입자는 샴페인 금빛, 일부는 푸른 진주빛
    const col = p.rim && rimK > 0 ? rc : p.h3 < 0.14 ? '#EAD5AC' : p.h3 > 0.9 ? '#DCE6EA' : PEARL
    if (fl > 0.04) {
      lx.fillStyle = PEARL
      lx.globalAlpha = Math.min(1, a * 0.8 + 0.3 * fl)
      lx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6)
      if (p.r < 0.18) { lx.globalAlpha *= 0.28; lx.fillRect(x - 0.45, y + 1, 0.9, 14 * fl) }
      continue
    }
    const dz = Math.abs(y - fy) / 640
    if (dz > 0.3 && p.r < 0.005 && p.e === 0) {
      const rr = 3 + dz * 15
      bx.fillStyle = col
      bx.globalAlpha = a * 0.22
      bx.beginPath(); bx.arc(x, y, rr, 0, 6.283); bx.fill()
      bx.strokeStyle = col
      bx.globalAlpha = a * 0.28
      bx.lineWidth = 1
      bx.stroke()
    } else if (dz < 0.55 || p.r < 0.45) {
      const s = 1.2 + p.r * 1.0 + dz * 2.4
      // 초점면에서 먼 입자는 흐린 층으로(얕은 심도) — 구슬처럼 보이는 원판 대신
      const soft = p.h2 < clamp((dz - 0.28) / 0.34)
      const tg = soft ? bx : lx
      tg.fillStyle = col
      // 흐려진 입자는 퍼질 뿐 빛의 양은 같다 — 초점 밖 어깨가 사라지지 않게 감쇠를 약하게
      tg.globalAlpha = Math.min(1, soft ? a * (1 - Math.min(0.4, dz * 0.5)) * 1.3 : a * (1 - Math.min(0.6, dz)))
      tg.fillRect(x - s / 2, y - s / 2, s, s)
    }
  }
  const y0 = b.top - 70, y1 = FLOOR + 50
  region(B.c, 0, y0, W, y1 - y0, 2.2)
  ctx.drawImage(L.c, 0, 0)
  const gl = o.glow ?? 1
  if (gl > 0) for (const [bl, al] of [[2.5, 0.6], [10, 0.4], [30, 0.3]] as const) region(L.c, 0, y0, W, y1 - y0, bl, al * gl, 'lighter')
}

/* ───────── 이름(S17) ───────── */
const NM = { x: 872, y0: 486, step: 204, size: 172 }
const NAME = ['太', '陰', '人']
const JADE = '#7FBF98'
/** 세로쓰기 太陰人: 글자마다 위에서 아래로 붓이 지나가듯 드러나고, 붓끝에 빛이 맺힌다 */
function nameGlyphs(ks: number[], alpha: number, rim: number) {
  if (alpha <= 0 || ks.every((k) => k <= 0)) return
  const A = tmp(), F = tmp(), S = tmp()
  const font = `200 ${NM.size}px ${FONT.serif}`
  const bx0 = NM.x - NM.size * 0.75, bw = NM.size * 1.5
  const by0 = NM.y0 - NM.size - 30, bh = NM.step * 2 + NM.size + 90
  let front = false
  ks.forEach((k, i) => {
    if (k <= 0) return
    const y = NM.y0 + i * NM.step
    const top = y - NM.size * 0.9, bot = y + NM.size * 0.14
    const yf = lerp(top - 40, bot + 40, ease.inOut3(clamp(k)))
    // 몸체
    S.x.clearRect(0, 0, W, H)
    S.x.save(); S.x.font = font; S.x.textAlign = 'center'; S.x.fillStyle = C.pearl; S.x.fillText(NAME[i], NM.x, y); S.x.restore()
    if (k < 1) {
      S.x.save()
      S.x.globalCompositeOperation = 'destination-in'
      const g = S.x.createLinearGradient(NM.x - 14, yf - 34, NM.x + 14, yf + 34)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      S.x.fillStyle = g; S.x.fillRect(0, 0, W, H)
      S.x.restore()
    }
    const sharp = ease.sine(seg(k, 0.45, 1))
    A.x.save()
    if (sharp < 1) A.x.filter = `blur(${(1 - sharp) * 3.5}px)`
    A.x.drawImage(S.c, 0, 0)
    A.x.restore()
    // 붓끝의 빛
    if (k > 0 && k < 1) {
      front = true
      S.x.clearRect(0, 0, W, H)
      S.x.save(); S.x.font = font; S.x.textAlign = 'center'; S.x.fillStyle = C.amberCore; S.x.fillText(NAME[i], NM.x, y)
      S.x.globalCompositeOperation = 'destination-in'
      const b = S.x.createLinearGradient(NM.x - 14, yf - 40, NM.x + 14, yf + 12)
      b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(0.72, 'rgba(0,0,0,1)'); b.addColorStop(1, 'rgba(0,0,0,0)')
      S.x.fillStyle = b; S.x.fillRect(0, 0, W, H)
      S.x.restore()
      F.x.globalAlpha = Math.sin(Math.PI * clamp(k))
      F.x.drawImage(S.c, 0, 0)
      F.x.globalAlpha = 1
    }
  })
  region(A.c, bx0, by0, bw, bh, 0, alpha)
  // 석록 후광(체질색)
  S.x.clearRect(0, 0, W, H)
  S.x.drawImage(A.c, 0, 0)
  S.x.globalCompositeOperation = 'source-in'
  S.x.fillStyle = JADE
  S.x.fillRect(bx0, by0, bw, bh)
  S.x.globalCompositeOperation = 'source-over'
  region(S.c, bx0, by0, bw, bh, 10, alpha * 0.32 * (0.4 + 0.6 * rim), 'lighter')
  region(S.c, bx0, by0, bw, bh, 34, alpha * 0.3 * (0.4 + 0.6 * rim), 'lighter')
  if (front) {
    region(F.c, bx0, by0, bw, bh, 0, alpha, 'lighter')
    region(F.c, bx0, by0, bw, bh, 7, alpha * 0.9, 'lighter')
    region(F.c, bx0, by0, bw, bh, 22, alpha * 0.55, 'lighter')
  }
}
/** 이름 옆 계측선: 금니 세로선 + 글자 중심 눈금 */
function nameRule(k: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  const x = NM.x - 128
  const y0 = NM.y0 - NM.size * 0.95, y1 = SEAL_P.y - SEAL_P.size * 0.5 - 22
  const e = ease.out3(k)
  lineA(x, y0, x, lerp(y0, y1, e), C.gold, 1, 0.45 * alpha)
  for (let i = 0; i < 3; i++) {
    const yc = NM.y0 + i * NM.step - NM.size * 0.38
    if (yc > lerp(y0, y1, e)) break
    lineA(x, yc, x + 12, yc, C.gold, 1, 0.6 * alpha)
    mono(`0${i + 1}`, x - 10, yc + 5, C.gold, 15, 'right', 0.55 * alpha)
  }
}
/** 이름 아래 캡션: 한글 이름 · 로마자 · 경향 수치 */
const CAP = { kor: 1046, lat: 1096, line: 1126, m1: 1180, m2: 1224 }
function nameCaption(p: { kor: number; lat: number; line: number; mono: number }, alpha: number) {
  if (alpha <= 0) return
  revealText('태음인', NM.x, CAP.kor, `300 60px ${FONT.hahmlet}`, C.hanji, p.kor, { align: 'center', spacing: 4, alpha })
  if (p.lat > 0) text('Taeeum-in', NM.x, CAP.lat, `italic 300 38px ${FONT.italic}`, C.gold, { align: 'center', alpha: ease.sine(p.lat) * alpha, blur: (1 - ease.out3(p.lat)) * 6, spacing: 1 })
  if (p.line > 0) {
    const hw = 104 * ease.out3(p.line)
    lineA(NM.x - hw, CAP.line, NM.x + hw, CAP.line, C.gold, 1, 0.55 * alpha)
  }
  if (p.mono > 0) {
    const a = ease.sine(p.mono) * alpha
    mono('경향 62%', NM.x, CAP.m1, C.amberCore, 32, 'center', a)
    mono('소양 24 · 소음 14', NM.x, CAP.m2, '#A39C8E', 26, 'center', a * 0.95)
  }
}
/** 낙관: 이름 옆(人의 왼쪽 아래, 금니 계측선의 끝) */
const SEAL_P = { x: 744, y: 930, size: 66 }
/** 유리 물방울: 안에 거꾸로 맺힌 太陰人 */
function dropFx(y: number, alpha: number) {
  if (alpha <= 0) return
  // 낙하 잔상
  ctx.save()
  const g = ctx.createLinearGradient(0, y - 150, 0, y - 36)
  g.addColorStop(0, 'rgba(255,244,220,0)'); g.addColorStop(1, `rgba(255,244,220,${0.16 * alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(NM.x - 1, Math.max(124, y - 150), 2, Math.max(0, y - 36 - Math.max(124, y - 150)))
  ctx.restore()
  const R = 42
  droplet(NM.x, y, R, alpha, () => {
    ctx.save()
    ctx.translate(NM.x, y)
    ctx.rotate(Math.PI)
    ctx.scale(1.3, 1)
    for (let i = 0; i < 3; i++) text(NAME[i], 0, -21 + i * 21, `400 19px ${FONT.serif}`, C.pearl, { align: 'center', baseline: 'middle', alpha: 0.85 * alpha, blur: 0.5 })
    ctx.restore()
  })
  // 아래쪽에 모이는 빛(커스틱)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = `rgba(255,232,190,${0.55 * alpha})`
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(NM.x, y, R * 0.86, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke()
  ctx.restore()
}
/** 물방울이 닿은 자리의 동심 빛고리(정면) */
function ringRipple(x: number, y: number, k: number) {
  for (let i = 0; i < 3; i++) {
    const kk = clamp((k - i * 0.13) / 0.74)
    if (kk <= 0 || kk >= 1) continue
    const R = 12 + 150 * ease.out3(kk)
    ctx.save()
    ctx.strokeStyle = `rgba(255,236,200,${0.5 * (1 - ease.sine(kk))})`
    ctx.lineWidth = 1.4 - i * 0.35
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.9, 0, 0, 6.283); ctx.stroke()
    ctx.restore()
  }
}
/** S17 무대 상태 */
interface RevealP { cam: Cam; T: number; rim: number; bokeh: number; glyph: number[]; rule: number; cap: { kor: number; lat: number; line: number; mono: number }; seal: number }
function revealStage(p: RevealP, nameOff = { x: 0, y: 0 }) {
  withCam(p.cam, () => {
    beamFx(1, p.T)
    floorFx(1)
    floorLine(1, 0.55)
    dustFx(p.T, 1)
    drawBust({ T: p.T, gather: 1, rim: p.rim })
  })
  ctx.save()
  ctx.translate(nameOff.x, nameOff.y)
  nameRule(p.rule, 1)
  nameGlyphs(p.glyph, 1, p.rim)
  seal(SEAL_P.x, SEAL_P.y, SEAL_P.size, '觀形', p.seal, -0.04)
  nameCaption(p.cap, 1)
  ctx.restore()
}
const FULL_NAME = { glyph: [1, 1, 1], rule: 1, cap: { kor: 1, lat: 1, line: 1, mono: 1 }, seal: 1 }

/* ───────── 판독서(S18) ───────── */
/** 최종 화면 좌표. 족자의 천간은 세계 좌표의 바닥선(FLOOR)에 걸려 있다 */
const PAPER = { x: 100, w: 880, y0: 184, y1: 1700 }
const ROD_H = 16
const D = FLOOR - (PAPER.y0 - ROD_H) // 카메라 틸트 거리
const INK = '#17130F'
const INK2 = 'rgba(42,34,26,0.74)'
const SHU = '#9E3A22' // 주서(朱書)

let paperC: HTMLCanvasElement | null = null
function paperCache() {
  if (paperC) return paperC
  const P = layer()
  const { x, w, y0, y1 } = PAPER
  const h = y1 - y0
  onLayer(() => hanji(x, y0, w, h, 1, { halo: false }), P)
  P.x.save()
  P.x.beginPath(); P.x.rect(x, y0, w, h); P.x.clip()
  // 위에서 떨어지는 빛(따뜻하게), 아래로 갈수록 식는다
  P.x.globalCompositeOperation = 'screen'
  const hg = P.x.createRadialGradient(540, y0 - 80, 0, 540, y0 - 80, 620)
  hg.addColorStop(0, 'rgba(255,214,150,0.42)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.12)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
  P.x.fillStyle = hg
  P.x.fillRect(x, y0, w, h)
  P.x.globalCompositeOperation = 'multiply'
  const vg = P.x.createLinearGradient(0, y0, 0, y1)
  vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(0.6, 'rgba(236,226,206,1)'); vg.addColorStop(1, 'rgba(196,178,146,1)')
  P.x.fillStyle = vg
  P.x.fillRect(x, y0, w, h)
  const edge = (gx0: number, gx1: number, rx: number, rw: number) => {
    const g = P.x.createLinearGradient(gx0, 0, gx1, 0)
    g.addColorStop(0, 'rgba(110,86,56,0.5)'); g.addColorStop(1, 'rgba(110,86,56,0)')
    P.x.fillStyle = g; P.x.fillRect(rx, y0, rw, h)
  }
  edge(x, x + 26, x, 26)
  edge(x + w, x + w - 26, x + w - 26, 26)
  const tg = P.x.createLinearGradient(0, y0, 0, y0 + 30)
  tg.addColorStop(0, 'rgba(90,66,40,0.55)'); tg.addColorStop(1, 'rgba(90,66,40,0)')
  P.x.fillStyle = tg; P.x.fillRect(x, y0, w, 30)
  P.x.restore()
  paperC = P.c
  return P.c
}
let haloC: HTMLCanvasElement | null = null
function haloCache() {
  if (haloC) return haloC
  const P = layer()
  P.x.filter = 'blur(70px)'
  P.x.fillStyle = 'rgba(241,230,207,0.34)'
  P.x.fillRect(PAPER.x - 30, PAPER.y0 - 10, PAPER.w + 60, PAPER.y1 - PAPER.y0 + 30)
  haloC = P.c
  return P.c
}
/** 막대(천간·축) */
function rod(x0: number, x1: number, y: number, h: number, a: number, knobs = false) {
  if (a <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(a)
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, '#7a5c3c'); g.addColorStop(0.3, '#2e2118'); g.addColorStop(1, '#0c0907')
  ctx.fillStyle = g
  ctx.fillRect(x0, y, x1 - x0, h)
  ctx.fillStyle = 'rgba(255,220,160,0.55)'
  ctx.fillRect(x0 + 4, y, x1 - x0 - 8, 1)
  if (knobs) {
    for (const kx of [x0 - 16, x1]) {
      const kg = ctx.createLinearGradient(0, y - 4, 0, y + h + 4)
      kg.addColorStop(0, '#e2d3b6'); kg.addColorStop(0.45, '#958670'); kg.addColorStop(1, '#2a241b')
      ctx.fillStyle = kg
      ctx.fillRect(kx, y - 4, 16, h + 8)
    }
  }
  ctx.restore()
}
/** 말린 종이(원통) + 축 */
function rollFx(y: number, a: number, done: boolean) {
  if (a <= 0) return
  const { x, w } = PAPER
  ctx.save()
  ctx.globalAlpha = clamp(a)
  // 종이 아래 그림자
  const sg = ctx.createLinearGradient(0, y - 18, 0, y)
  sg.addColorStop(0, 'rgba(60,44,26,0)'); sg.addColorStop(1, 'rgba(60,44,26,0.45)')
  ctx.fillStyle = sg
  ctx.fillRect(x, y - 18, w, 18)
  if (!done) {
    const g = ctx.createLinearGradient(0, y, 0, y + 26)
    g.addColorStop(0, '#efe2c6'); g.addColorStop(0.35, '#d2bf98'); g.addColorStop(0.8, '#7d6a4c'); g.addColorStop(1, '#2c2418')
    ctx.fillStyle = g
    ctx.fillRect(x - 2, y, w + 4, 26)
    ctx.fillStyle = 'rgba(255,250,236,0.6)'
    ctx.fillRect(x, y + 4, w, 1)
  }
  ctx.restore()
  rod(x - 16, x + w + 16, done ? y : y + 24, done ? 18 : 12, a, true)
}

interface RepK { title: number; ring: number; legend: number; honest: number; grid: number; ink: number; ev: number; chips: number; foot: number; seal: number }
const REP_DONE: RepK = { title: 1, ring: 1, legend: 1, honest: 1, grid: 1, ink: 1, ev: 1, chips: 1, foot: 1, seal: 1 }
const CX0 = 160, CX1 = 920

function ruleFx(y: number, k: number, alpha = 0.22) {
  if (k <= 0) return
  lineA(CX0, y, lerp(CX0, CX1, ease.out3(k)), y, INK, 1, alpha)
}
function sectionLabel(hz: string, ko: string, x: number, y: number, k: number) {
  if (k <= 0) return
  const a = ease.sine(k)
  text(hz, x, y, `400 25px ${FONT.serif}`, SHU, { alpha: 0.85 * a, spacing: 6 })
  text(ko, x + textW(hz, `400 25px ${FONT.serif}`, 6) + 14, y - 1, `500 23px ${FONT.sans}`, INK2, { alpha: a, spacing: 2 })
}
/** 석채 호(돌가루 안료의 입자감) */
function pigmentArc(cx: number, cy: number, r: number, w: number, a0: number, span: number, aEnd: number, color: string, seed: number) {
  const a1 = Math.min(a0 + span, aEnd)
  if (a1 <= a0) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.globalAlpha = 0.9
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke()
  // 안료 가장자리의 고르지 않은 결
  ctx.globalAlpha = 0.35
  ctx.lineWidth = w + 3
  ctx.setLineDash([2, 3, 1, 4])
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke()
  ctx.setLineDash([])
  const rr = rng(seed)
  const n = Math.round(1300 * (span / 6.283)) + 60
  for (let i = 0; i < n; i++) {
    const a = a0 + rr() * span, d = r + (rr() - 0.5) * w * 0.95, s = 0.8 + rr() * 1.8, dark = rr() < 0.55
    if (a > a1) continue
    ctx.globalAlpha = dark ? 0.22 : 0.3
    ctx.fillStyle = dark ? '#0d0c0a' : '#fff6e2'
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s)
  }
  ctx.restore()
}
const RG = { x: 322, y: 586, r: 132, w: 22 }
const PROB = [
  { k: 'taeeum', hz: '太陰', ko: '태음', v: 62 },
  { k: 'soyang', hz: '少陽', ko: '소양', v: 24 },
  { k: 'soeum', hz: '少陰', ko: '소음', v: 14 },
] as const
function ringFx(k: number) {
  if (k <= 0) return
  const kt = ease.out3(clamp(k * 1.8))
  for (let i = 0; i < 100; i++) {
    if (i / 100 > kt) break
    const a = -Math.PI / 2 + (i / 100) * Math.PI * 2
    const major = i % 10 === 0
    const r0 = RG.r + 20, r1 = r0 + (major ? 11 : 5)
    lineA(RG.x + Math.cos(a) * r0, RG.y + Math.sin(a) * r0, RG.x + Math.cos(a) * r1, RG.y + Math.sin(a) * r1, INK, 1, major ? 0.5 : 0.24)
  }
  ctx.save()
  ctx.globalAlpha = 0.1 * kt
  ctx.strokeStyle = INK
  ctx.lineWidth = RG.w
  ctx.beginPath(); ctx.arc(RG.x, RG.y, RG.r, 0, 6.283); ctx.stroke()
  ctx.restore()
  const ka = ease.inOut3(seg(k, 0.15, 0.85))
  const aEnd = -Math.PI / 2 + ka * Math.PI * 2
  let acc = 0
  PROB.forEach((p, i) => {
    const a0 = -Math.PI / 2 + (acc / 100) * Math.PI * 2 + 0.014
    const span = (p.v / 100) * Math.PI * 2 - 0.028
    acc += p.v
    pigmentArc(RG.x, RG.y, RG.r, RG.w, a0, span, aEnd, TYPE_COL[p.k], 50 + i)
  })
  const kn = ease.sine(seg(k, 0.5, 1))
  if (kn > 0) {
    text('62', RG.x - 10, RG.y + 30, `italic 300 112px ${FONT.italic}`, INK, { align: 'center', alpha: kn, blur: (1 - kn) * 6 })
    text('%', RG.x + 52, RG.y + 28, `italic 300 40px ${FONT.italic}`, INK2, { alpha: kn })
    text('太陰 傾向', RG.x, RG.y + 72, `400 23px ${FONT.serif}`, INK2, { align: 'center', alpha: kn, spacing: 6 })
  }
}
function legendFx(k: number) {
  if (k <= 0) return
  const x0 = 566, x1 = 920
  const rows = [...PROB.map((p) => ({ ...p, dim: false })), { k: 'taeyang' as const, hz: '太陽', ko: '태양', v: 0, dim: true }]
  rows.forEach((p, i) => {
    const kk = clamp(k * 1.7 - i * 0.22)
    if (kk <= 0) return
    const y = 498 + i * 64
    const a = ease.sine(kk)
    const da = p.dim ? 0.34 : 1
    ctx.save()
    ctx.globalAlpha = a * da
    if (p.dim) { ctx.strokeStyle = TYPE_COL.taeyang; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.75, y - 30, 11, 34) }
    else { ctx.fillStyle = TYPE_COL[p.k]; ctx.fillRect(x0, y - 30, 12, 34) }
    ctx.restore()
    text(p.hz, x0 + 32, y, `400 30px ${FONT.serif}`, INK, { alpha: a * da, spacing: 2 })
    text(p.ko, x0 + 112, y - 2, `300 27px ${FONT.hahmlet}`, INK2, { alpha: a * da })
    if (!p.dim) {
      text(String(p.v), x1 - 24, y + 4, `italic 300 48px ${FONT.italic}`, INK, { align: 'right', alpha: a })
      text('%', x1, y + 2, `italic 300 24px ${FONT.italic}`, INK2, { align: 'right', alpha: a })
    } else text('판별 제외', x1, y - 3, `500 23px ${FONT.sans}`, INK2, { align: 'right', alpha: a * 0.7, spacing: 1 })
    lineA(x0, y + 21, lerp(x0, x1, ease.out3(kk)), y + 21, INK, 1, 0.15)
  })
}
function honestFx(k: number) {
  if (k <= 0) return
  // 정직한 한 줄 — 작게 숨기지 않고 두 줄로 읽히게(26px)
  const kk = ease.sine(k)
  lineA(CX0, 783, CX0 + 26, 783, SHU, 1.2, 0.7 * kk)
  text('판정 일치도가 아닌 모델 확신도', CX0 + 40, 792, `500 26px ${FONT.sans}`, INK2, { alpha: kk })
  text('전문가 진단 일치율 연구상 55~69%', CX0 + 40, 830, `400 26px ${FONT.sans}`, INK2, { alpha: kk * 0.92 })
}
const RD = { x: 322, y: 1130, R: 124 }
const ORG = [{ hz: '肺', v: 0.36 }, { hz: '脾', v: 0.6 }, { hz: '肝', v: 0.9 }, { hz: '腎', v: 0.62 }]
const orgAng = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2
function radarFx(kg: number, ki: number) {
  if (kg > 0) {
    const ge = ease.out3(kg)
    for (const f of [1 / 3, 2 / 3, 1]) {
      ctx.save()
      ctx.globalAlpha = 0.5 * ge
      ctx.strokeStyle = C.celadonDeep
      ctx.lineWidth = f === 1 ? 1.2 : 0.9
      ctx.setLineDash(f === 1 ? [] : [3, 5])
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = orgAng(i), x = RD.x + Math.cos(a) * RD.R * f, y = RD.y + Math.sin(a) * RD.R * f
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.stroke()
      ctx.restore()
    }
    ORG.forEach((o, i) => {
      const a = orgAng(i)
      lineA(RD.x, RD.y, RD.x + Math.cos(a) * RD.R * ge, RD.y + Math.sin(a) * RD.R * ge, C.celadonDeep, 1, 0.55)
      const lx = RD.x + Math.cos(a) * (RD.R + 34), ly = RD.y + Math.sin(a) * (RD.R + 34) + 11
      text(o.hz, lx, ly, `400 30px ${FONT.serif}`, INK, { align: 'center', alpha: ease.sine(seg(kg, 0.3 + i * 0.12, 0.8 + i * 0.05)) })
    })
  }
  if (ki > 0) {
    // 먹: 담묵을 여러 번 겹쳐 번지게 하고, 가운데(肝 쪽)는 농묵, 가장자리는 조수선과 실번짐
    const L = tmp(), F = tmp()
    const e = ease.ink(ki)
    const r = rng(404)
    const vtx = (i: number, sc: number, jx = 0, jy = 0) => {
      const a = orgAng(i), rr = RD.R * ORG[i].v * e * sc
      return [RD.x + Math.cos(a) * rr + jx, RD.y + Math.sin(a) * rr + jy] as const
    }
    const poly = (x: Ctx, sc: number, jit?: number[][]) => {
      x.beginPath()
      for (let i = 0; i < 4; i++) {
        const [px, py] = vtx(i, sc, jit?.[i][0] ?? 0, jit?.[i][1] ?? 0)
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py)
      }
      x.closePath()
    }
    for (let j = 0; j < 10; j++) {
      const jit = ORG.map(() => [(r() - 0.5) * 12, (r() - 0.5) * 12])
      L.x.fillStyle = 'rgba(20,18,15,0.05)'
      poly(L.x, 0.94 + r() * 0.1, jit)
      L.x.fill()
    }
    const cg = L.x.createRadialGradient(RD.x, RD.y + RD.R * 0.55 * e, 0, RD.x, RD.y + RD.R * 0.55 * e, RD.R * 0.8)
    cg.addColorStop(0, 'rgba(10,10,9,0.55)'); cg.addColorStop(0.5, 'rgba(10,10,9,0.18)'); cg.addColorStop(1, 'rgba(10,10,9,0)')
    L.x.save(); poly(L.x, 1); L.x.clip(); L.x.fillStyle = cg; L.x.fillRect(RD.x - RD.R, RD.y - RD.R, RD.R * 2, RD.R * 2); L.x.restore()
    // 조수선 + 실번짐(선명하게)
    F.x.strokeStyle = 'rgba(14,13,11,0.42)'
    F.x.lineWidth = 1.4
    poly(F.x, 1)
    F.x.stroke()
    F.x.lineCap = 'round'
    for (let j = 0; j < 90; j++) {
      const i = Math.floor(r() * 4), t2 = r()
      const [ax, ay] = vtx(i, 1), [bx2, by2] = vtx((i + 1) % 4, 1)
      let px = lerp(ax, bx2, t2), py = lerp(ay, by2, t2)
      const nx = (px - RD.x), ny = (py - RD.y), nl = Math.hypot(nx, ny) || 1
      let a = Math.atan2(ny / nl, nx / nl) + (r() - 0.5) * 1.2
      const len = (3 + r() * (r() < 0.15 ? 18 : 7)) * e
      F.x.strokeStyle = `rgba(14,13,11,${0.12 + r() * 0.25})`
      F.x.lineWidth = 0.4 + r() * 0.7
      F.x.beginPath(); F.x.moveTo(px, py)
      for (let st = 0; st < 3; st++) { a += (r() - 0.5) * 0.8; px += (Math.cos(a) * len) / 3; py += (Math.sin(a) * len) / 3; F.x.lineTo(px, py) }
      F.x.stroke()
    }
    for (let i = 0; i < 4; i++) {
      const [px, py] = vtx(i, 1)
      F.x.fillStyle = 'rgba(12,11,10,0.8)'
      F.x.beginPath(); F.x.arc(px, py, 2.6, 0, 6.283); F.x.fill()
    }
    const bb = [RD.x - RD.R - 40, RD.y - RD.R - 40, RD.R * 2 + 80, RD.R * 2 + 80] as const
    region(L.c, ...bb, 1.6 + (1 - ki) * 10, clamp(ki * 3))
    region(F.c, ...bb, 0.5 + (1 - ki) * 4, ease.sine(seg(ki, 0.25, 0.9)))
  }
}
const EV = [
  { name: 'BMI 20.4', tag: '문헌 지지', w: 0.31, lit: true },
  { name: '턱 폭', tag: '문헌 지지', w: 0.42, lit: true },
  { name: '땀', tag: '설문', w: 0.27, lit: false },
]
function evidenceFx(k: number) {
  if (k <= 0) return
  const x0 = 566, x1 = 920
  const L = tmp()
  let tips = false
  EV.forEach((e, i) => {
    const kk = clamp(k * 1.5 - i * 0.25)
    if (kk <= 0) return
    const y = 1002 + i * 104
    const a = ease.sine(kk)
    text(e.name, x0, y, `500 28px ${FONT.sans}`, INK, { alpha: a })
    const tf = `500 20px ${FONT.sans}`
    const tw = textW(e.tag, tf, 2) + 22
    const tc = e.lit ? C.celadonDeep : '#8A4A2E'
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.strokeStyle = tc; ctx.lineWidth = 1; ctx.strokeRect(x1 - tw + 0.5, y - 27.5, tw - 1, 36); ctx.restore()
    text(e.tag, x1 - tw / 2 + 1, y - 2, tf, tc, { align: 'center', alpha: a, spacing: 2 })
    text(e.w.toFixed(2), x1 - tw - 18, y + 1, `italic 300 32px ${FONT.italic}`, INK, { align: 'right', alpha: a * ease.sine(seg(kk, 0.55, 1)) })
    lineA(x0, y + 36, x1, y + 36, INK, 1, 0.16 * a)
    for (let j = 0; j <= 4; j++) lineA(x0 + ((x1 - x0) * j) / 4, y + 32, x0 + ((x1 - x0) * j) / 4, y + 40, INK, 1, 0.26 * a)
    const kb = ease.inOut3(seg(kk, 0.3, 1))
    const len = (x1 - x0) * (e.w / 0.5) * kb
    if (len > 0) {
      ctx.save(); ctx.fillStyle = 'rgba(22,18,14,0.86)'; ctx.fillRect(x0, y + 32, len, 8); ctx.restore()
      if (kb < 1) {
        tips = true
        L.x.fillStyle = 'rgba(255,214,150,1)'
        L.x.beginPath(); L.x.arc(x0 + len, y + 36, 4, 0, 6.283); L.x.fill()
      }
    }
  })
  if (tips) {
    region(L.c, x0 - 20, 950, x1 - x0 + 40, 320, 0, 1)
    region(L.c, x0 - 20, 950, x1 - x0 + 40, 320, 10, 0.9, 'lighter')
  }
}
const CHIPS = ['땀 내는 유산소 운동', '저녁 과식 줄이기', '무 · 도라지 · 율무', '아침 햇빛 산책']
const NUMS = ['一', '二', '三', '四']
function chipsFx(k: number) {
  if (k <= 0) return
  CHIPS.forEach((s, i) => {
    const kk = clamp(k * 1.6 - i * 0.2)
    if (kk <= 0) return
    const x = i % 2 ? 546 : CX0, y = 1414 + Math.floor(i / 2) * 88, w = 374, h = 72
    const a = ease.sine(kk)
    // 부전지(附箋): 아주 옅은 종이 한 겹과 먹 실선
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(255,250,236,0.22)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(24,20,15,0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    ctx.restore()
    text(NUMS[i], x + 24, y + h / 2 + 10, `400 26px ${FONT.serif}`, SHU, { alpha: a * 0.85 })
    lineA(x + 60, y + 18, x + 60, y + h - 18, INK, 1, 0.2 * a)
    revealText(s, x + 78, y + h / 2 + 10, `500 28px ${FONT.sans}`, INK, kk, { stagger: 0.05 })
  })
}
function footFx(k: number) {
  if (k <= 0) return
  const a = ease.sine(k)
  ruleFx(1612, k, 0.2)
  text('墨光判讀室', CX0, 1660, `400 20px ${FONT.serif}`, INK2, { alpha: a, spacing: 8 })
  mono('REFERENCE ONLY · 參考用', CX1, 1660, INK2, 15, 'right', a)
}
function reportContent(k: RepK) {
  // 제목
  revealText('太陰人', CX0, 296, `400 62px ${FONT.serif}`, INK, k.title, { spacing: 8 })
  revealText('태음인 경향', 382, 274, `300 34px ${FONT.hahmlet}`, INK, k.title, { spacing: 2 })
  if (k.title > 0) text('Taeeum-in · constitutional tendency', 382, 312, `italic 300 26px ${FONT.italic}`, INK2, { alpha: ease.sine(k.title) })
  seal(886, 270, 76, '觀形', k.seal, -0.04, 29)
  ruleFx(350, k.title, 0.3)
  // 1. 경향 고리
  sectionLabel('傾向', '체질 경향', CX0, 404, k.ring)
  sectionLabel('', '', 566, 404, 0)
  ringFx(k.ring)
  legendFx(k.legend)
  honestFx(k.honest)
  ruleFx(864, k.honest)
  // 2. 장부 · 근거
  sectionLabel('臟腑', '이론 도식', CX0, 914, k.grid)
  radarFx(k.grid, k.ink)
  sectionLabel('根據', '판별 근거', 566, 914, k.ev)
  evidenceFx(k.ev)
  ruleFx(1336, k.chips)
  // 3. 양생
  sectionLabel('養生', '생활 제안', CX0, 1386, k.chips)
  chipsFx(k.chips)
  footFx(k.foot)
}
/** 판독서 전체(최종 화면 좌표). u: 풀림 0→1 */
function reportFx(u: number, k: RepK, rodA = 1, light = 1) {
  const vis = lerp(PAPER.y0, PAPER.y1, u)
  if (u > 0.002) {
    // 종이 뒤 후광: 풀린 만큼만, 끝은 부드럽게(딱 잘린 수평선이 보이지 않게)
    const HL = tmp()
    HL.x.drawImage(haloCache(), 0, 0)
    HL.x.globalCompositeOperation = 'destination-in'
    const hg = HL.x.createLinearGradient(0, vis - 30, 0, vis + 170)
    hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)')
    HL.x.fillStyle = hg
    HL.x.fillRect(0, 0, W, H)
    ctx.save()
    ctx.globalAlpha = light
    ctx.drawImage(HL.c, 0, 0)
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.rect(PAPER.x, PAPER.y0, PAPER.w, vis - PAPER.y0); ctx.clip()
    ctx.globalAlpha = light
    ctx.drawImage(paperCache(), 0, 0)
    ctx.globalAlpha = 1
    reportContent(k)
    ctx.restore()
  }
  rod(PAPER.x - 14, PAPER.x + PAPER.w + 14, PAPER.y0 - ROD_H, ROD_H, rodA)
  rollFx(vis, rodA, u >= 1)
}

/* ───────── 먹 씻김(S19) ───────── */
/** 천간에서 먹이 풀려 한지를 타고 아래로 번진다. k 0→1. 지나간 자리는 거의 불투명한 먹으로 가라앉는다 */
function inkWash(k: number) {
  if (k <= 0) return
  const L = tmp(), F = tmp()
  const r = rng(919)
  const { x: px, w: pw, y0, y1 } = PAPER
  const top = y0 - 60
  const span = y1 - y0 + 320
  const yf = top + span * ease.inOut3(k)
  const ph = [r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283]
  const fingers = Array.from({ length: 9 }, () => ({ x: px + r() * pw, w: 18 + r() * 50, a: (30 + r() * 110) * Math.sin(Math.PI * clamp(k * 1.1)) }))
  const front = (xx: number) => {
    let y = yf + 58 * Math.sin(xx * 0.006 + ph[0]) + 24 * Math.sin(xx * 0.017 + ph[1]) + 7 * Math.sin(xx * 0.043 + ph[2]) + 2.5 * Math.sin(xx * 0.11 + ph[3])
    for (const f of fingers) y += f.a * Math.exp(-(((xx - f.x) / f.w) ** 2))
    return y
  }
  const X0 = px - 60, X1 = px + pw + 60
  const path = (x: Ctx, off: number) => {
    x.beginPath()
    x.moveTo(X0, top - 80)
    for (let xx = X0; xx <= X1; xx += 8) x.lineTo(xx, front(xx) + off)
    x.lineTo(X1, top - 80)
    x.closePath()
  }
  // 앞서 나가는 물번짐(연한 갈색 띠, 두 겹)
  L.x.fillStyle = 'rgba(70,58,42,0.16)'
  path(L.x, 70); L.x.fill()
  L.x.fillStyle = 'rgba(56,46,34,0.2)'
  path(L.x, 30); L.x.fill()
  // 먹 본체: 앞머리는 담묵, 지나간 자리는 거의 불투명
  const h = Math.max(40, yf + 60 - top)
  const g = L.x.createLinearGradient(0, top, 0, yf + 60)
  g.addColorStop(0, 'rgba(5,6,7,0.985)')
  g.addColorStop(clamp(1 - 420 / h, 0.01, 0.98), 'rgba(6,7,8,0.97)')
  g.addColorStop(clamp(1 - 220 / h, 0.02, 0.99), 'rgba(9,10,11,0.86)')
  g.addColorStop(1, 'rgba(14,15,16,0.4)')
  L.x.fillStyle = g
  path(L.x, 0); L.x.fill()
  // 농담 덩어리(앞머리 근처에서 피어난다)
  for (let j = 0; j < 22; j++) {
    const bx = px + r() * pw, by = yf - 40 - r() * 520, br = 50 + r() * 140
    if (by < top) continue
    const bg = L.x.createRadialGradient(bx, by, 0, bx, by, br)
    bg.addColorStop(0, `rgba(3,4,5,${0.22 + r() * 0.25})`); bg.addColorStop(1, 'rgba(3,4,5,0)')
    L.x.fillStyle = bg
    L.x.beginPath(); L.x.arc(bx, by, br, 0, 6.283); L.x.fill()
  }
  // 조수선(번짐 가장자리가 짙어지는 선)과 섬유를 타고 뻗는 실번짐 — 선명하게
  F.x.strokeStyle = 'rgba(5,6,7,0.18)'
  F.x.lineWidth = 1.6
  F.x.beginPath()
  for (let xx = X0; xx <= X1; xx += 8) { if (xx === X0) F.x.moveTo(xx, front(xx) + 6); else F.x.lineTo(xx, front(xx) + 6) }
  F.x.stroke()
  F.x.lineCap = 'round'
  const sp = 0.3 + 0.7 * Math.sin(Math.PI * clamp(k))
  for (let i = 0; i < 260; i++) {
    const sx = px - 20 + r() * (pw + 40)
    let cx2 = sx, cy2 = front(sx) + 2 + r() * 24
    let a = Math.PI / 2 + (r() - 0.5) * 2.4
    const len = (4 + r() * (r() < 0.12 ? 56 : 16)) * sp
    F.x.strokeStyle = `rgba(8,9,10,${0.1 + r() * 0.28})`
    F.x.lineWidth = 0.35 + r() * 0.8
    F.x.beginPath(); F.x.moveTo(cx2, cy2)
    for (let st = 0; st < 4; st++) { a += (r() - 0.5) * 0.8; cx2 += (Math.cos(a) * len) / 4; cy2 += (Math.sin(a) * len) / 4; F.x.lineTo(cx2, cy2) }
    F.x.stroke()
  }
  const bh = Math.min(H, yf + 220)
  region(L.c, X0, 0, X1 - X0, bh, 10)
  region(F.c, X0, 0, X1 - X0, bh, 1.1)
}

/** 처음으로 되돌아가는 숨: 한지 창이 윗변 가운데서부터 아주 희미하게 번져 켜진다 */
function relight(k: number) {
  const L = onLayer(() => hanji(WIN.x, WIN.y, WIN.w, WIN.h, 1, { halo: false }))
  L.x.globalCompositeOperation = 'destination-in'
  const R = lerp(120, 900, ease.out3(k))
  const g = L.x.createRadialGradient(W / 2, WIN.y - 40, 0, W / 2, WIN.y - 40, R)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  L.x.fillStyle = g
  L.x.fillRect(0, 0, W, H)
  drawBlur(L.c, 2, 0.2 * k)
  // 윗변에 남은 한 줄의 빛
  const hw = (WIN.w / 2) * ease.out3(k)
  ctx.save()
  const lg = ctx.createLinearGradient(W / 2 - hw, 0, W / 2 + hw, 0)
  lg.addColorStop(0, 'rgba(255,214,150,0)'); lg.addColorStop(0.5, `rgba(255,226,176,${0.42 * k})`); lg.addColorStop(1, 'rgba(255,214,150,0)')
  ctx.fillStyle = lg
  ctx.fillRect(W / 2 - hw, WIN.y - 1, hw * 2, 2)
  ctx.restore()
}

/* ───────── S15 ───────── */
const S15: Scene = {
  id: 'S15',
  act: ACT,
  title: '빛기둥이 열리다',
  note: '사유의 방의 침묵 속, 천장 한 점이 반짝이더니 한 줄의 빛이 칼날처럼 바닥까지 그어진다. 칼날은 천천히 원뿔로 열리며 먼지를 비추고, 바닥에 금빛 선이 그어지며 빛웅덩이에 고인 진주 가루가 반짝인다.',
  dur: 2.5,
  render(t) {
    const T = T0.S15 + t
    const glint = ease.sine(seg(t, 0.15, 0.55))
    const descent = ease.inOut3(seg(t, 0.4, 1.15))
    const open = ease.inOut3(seg(t, 0.9, 2.15))
    const pool = ease.sine(seg(t, 1.05, 2.2))
    const sc = 1 + 0.012 * ease.sine(seg(t, 1.2, 2.5))
    withCam({ sc, tx: 0, ty: 0 }, () => {
      beamFx(clamp(open * 1.4), T, open, Math.min(1, descent * 1.1))
      bladeFx((1 - ease.sine(seg(open, 0.25, 0.9))) * clamp(descent * 4), descent)
      floorFx(pool, Math.max(open, 0.1))
      floorLine(seg(t, 1.1, 1.95), 0.55 + 0.45 * (1 - pool * 0.6))
      dustFx(T, open)
      drawBust({ T, gather: 0, rest: pool, glow: 0.8 })
    })
    sourceGlint(glint * (1 - 0.55 * open))
    vignette(0.72)
    motes(T, moteA15(t), open) // S14에서는 비네트 위에 그려졌다
  },
}

/* ───────── S16 ───────── */
const S16: Scene = {
  id: 'S16',
  act: ACT,
  title: '진주 입자의 흉상',
  note: '바닥 빛웅덩이의 진주 가루가 빛기둥을 타고 떠올라 어깨부터 목, 얼굴, 정수리 순으로 흉상을 이룬다. 천장 단일 광원이 이마와 콧등을 밝히고 눈두덩에 그늘을 드리워, 반가사유상처럼 눈을 내리감은 담담한 얼굴이 빛과 그늘만으로 드러난다. 초점이 바닥에서 눈으로 옮겨 가며 뒤로 보케가 피어나고, 턱선에 태음의 석록빛 림이 스민다.',
  dur: 4,
  render(t) {
    const T = T0.S16 + t
    const b = bust()
    const sc = 1.012 + 0.028 * ease.sine(seg(t, 0, 4))
    const gather = seg(t, 0.15, 3.45)
    const focusY = lerp(FLOOR - 30, b.eyeY, ease.inOut3(seg(t, 0.5, 3.3)))
    bokehFx(ease.sine(seg(t, 1.3, 3.6)), T)
    withCam({ sc, tx: 0, ty: 0 }, () => {
      beamFx(1, T)
      floorFx(1 - 0.25 * ease.sine(seg(t, 0.5, 3)))
      floorLine(1, 0.55)
      dustFx(T, 1)
      drawBust({ T, gather, focusY, rest: 1, rim: 0.6 * ease.sine(seg(t, 2.5, 4)), glow: lerp(0.8, 1, ease.sine(seg(t, 1, 3.5))) })
    })
    vignette(0.72)
    motes(T, moteA15(2.5) * (1 - ease.sine(seg(t, 0, 1.6))), 1)
    header(HEAD_L, HEAD_R, ease.sine(seg(t, 3.1, 4)))
  },
}

/* ───────── S17 ───────── */
const S17: Scene = {
  id: 'S17',
  act: ACT,
  title: '이름이 맺히다',
  note: '카메라가 흉상을 왼쪽으로 비켜 세우면, 안에 太陰人이 거꾸로 비친 유리 물방울이 오른쪽 어둠으로 떨어져 파문을 남긴다. 그 자리에서 太陰人이 붓이 지나가듯 한 자씩 위에서 아래로 맺히고, 태음인 · 경향 수치가 새겨진 뒤 이름 옆 계측선 끝에 주사 낙관 觀形이 찍힌다.',
  dur: 5.5,
  render(t) {
    const T = T0.S17 + t
    const ce = ease.inOut3(seg(t, 0, 1.7))
    const cam = { sc: lerp(1.04, 1, ce), tx: lerp(0, -130, ce), ty: 0 }
    const IMP = 1.45
    const glyph = [0, 1, 2].map((i) => seg(t, 1.55 + i * 0.42, 2.3 + i * 0.42))
    bokehFx(1, T, cam.tx * 0.3)
    revealStage({
      cam, T, rim: lerp(0.6, 1, ease.sine(seg(t, 1.6, 3.4))), bokeh: 1, glyph,
      rule: seg(t, 1.5, 3.2),
      cap: { kor: seg(t, 3.05, 3.75), lat: seg(t, 3.35, 3.95), line: seg(t, 3.55, 4.15), mono: seg(t, 3.75, 4.35) },
      seal: seg(t, 4.45, 4.95),
    })
    // 낙관이 찍히는 순간 아주 짧은 빛
    const sf = seg(t, 4.5, 4.9)
    if (sf > 0 && sf < 1) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const g = ctx.createRadialGradient(SEAL_P.x, SEAL_P.y, 0, SEAL_P.x, SEAL_P.y, 140)
      g.addColorStop(0, `rgba(255,150,110,${0.28 * Math.sin(Math.PI * sf)})`); g.addColorStop(1, 'rgba(255,150,110,0)')
      ctx.fillStyle = g
      ctx.fillRect(SEAL_P.x - 150, SEAL_P.y - 150, 300, 300)
      ctx.restore()
    }
    vignette(0.72)
    header(HEAD_L, HEAD_R)
    // 물방울 낙하 → 파문
    const kf = seg(t, 0.35, IMP)
    if (kf > 0 && t < IMP + 0.04) {
      const y = lerp(-90, NM.y0 - NM.size * 0.98, kf * kf * 0.7 + kf * 0.3)
      dropFx(y, 1 - seg(t, IMP - 0.02, IMP + 0.04))
    }
    const kr = seg(t, IMP, IMP + 1.3)
    if (kr > 0 && kr < 1) {
      const iy = NM.y0 - NM.size * 0.98
      ringRipple(NM.x, iy, kr)
      const fl = 1 - ease.out3(seg(t, IMP, IMP + 0.5))
      if (fl > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        const g = ctx.createRadialGradient(NM.x, iy, 0, NM.x, iy, 160)
        g.addColorStop(0, `rgba(255,240,214,${0.7 * fl})`); g.addColorStop(0.3, `rgba(255,214,150,${0.2 * fl})`); g.addColorStop(1, 'rgba(255,214,150,0)')
        ctx.fillStyle = g
        ctx.fillRect(NM.x - 170, iy - 170, 340, 340)
        ctx.restore()
      }
    }
    disclaimer(ease.sine(seg(t, 0, 0.6)))
  },
}

/* ───────── S18 ───────── */
function repAt(t: number): RepK {
  return {
    title: seg(t, 1.15, 1.9), ring: seg(t, 1.7, 3.0), legend: seg(t, 2.0, 3.1), honest: seg(t, 2.8, 3.4),
    grid: seg(t, 2.5, 3.2), ink: seg(t, 2.9, 4.2), ev: seg(t, 3.1, 4.5), chips: seg(t, 3.8, 4.8), foot: seg(t, 4.3, 4.9), seal: seg(t, 4.95, 5.45),
  }
}
const S18: Scene = {
  id: 'S18',
  act: ACT,
  title: '두루마리 판독서',
  note: '카메라가 아래로 기울며 흉상과 이름이 위로 빠지고, 바닥의 금빛 선이 족자의 천간이 되어 한지 판독서가 아래로 풀린다. 석채 호로 그린 세 체질 경향, 먹으로 번지는 장부 이론 도식, 빛이 긋는 근거 막대와 양생 제안이 차례로 맺히고 마지막에 낙관이 찍힌다.',
  dur: 6,
  render(t) {
    const T = T0.S18 + t
    const el = seg(t, 0.3, 2.3)
    const e = ease.inOut3(el)
    const cam = { sc: 1, tx: lerp(-130, 0, e), ty: -D * e }
    const u = ease.inOut3(seg(t, 0.55, 2.65))
    const rodA = ease.sine(seg(t, 0.05, 0.55))
    const mb = 6 * Math.sin(Math.PI * el) ** 2
    bokehFx(1 - ease.sine(seg(t, 0.3, 1.6)), T, cam.tx * 0.3, cam.ty * 0.3)
    const WL = onLayer(() => {
      if (cam.ty > -1400) {
        revealStage({ cam, T, rim: 1, bokeh: 0, ...FULL_NAME }, { x: cam.tx + 130, y: cam.ty })
      } else {
        withCam(cam, () => {
          beamFx(1, T)
          floorFx(1)
          dustFx(T, 1)
        })
      }
      withCam(cam, () => {
        ctx.translate(0, D)
        reportFx(u, repAt(t), rodA)
      })
    })
    drawBlur(WL.c, mb)
    vignette(0.72)
    header(HEAD_L, HEAD_R)
    disclaimer()
  },
}

/* ───────── S19 ───────── */
const S19: Scene = {
  id: 'S19',
  act: ACT,
  title: '먹으로 거두다',
  note: '천장의 빛이 꺼지고 먹이 판독서 위로 번져 내려와 모든 기록을 덮는다. 어둠 위에 “결과는 저장되지 않았습니다 · 감사합니다”가 빛으로 맺혔다 사라지고, 완전한 암전 뒤 한지 창이 희미하게 다시 켜져 처음으로 돌아간다.',
  dur: 4,
  render(t) {
    const T = T0.S19 + t
    const off = 1 - ease.sine(seg(t, 0.3, 1.6))
    withCam({ sc: 1, tx: 0, ty: -D }, () => {
      beamFx(off, T)
      floorFx(off)
      dustFx(T, off)
    })
    reportFx(1, REP_DONE, 1, 1 - 0.6 * ease.sine(seg(t, 0.4, 2.2)))
    inkWash(seg(t, 0.2, 2.1))
    // 먹이 종이에 배어들며 가라앉는다(남은 글자의 잔상까지 덮는다)
    const settle = ease.sine(seg(t, 1.3, 2.3))
    if (settle > 0) {
      ctx.save()
      ctx.globalAlpha = 0.9 * settle
      ctx.fillStyle = C.void
      ctx.fillRect(PAPER.x - 20, PAPER.y0 - ROD_H - 6, PAPER.w + 40, PAPER.y1 - PAPER.y0 + ROD_H + 40)
      ctx.restore()
    }
    // 먹 위에 빛으로 맺히는 인사
    const fade = 1 - ease.sine(seg(t, 3.0, 3.35))
    revealText('결과는 저장되지 않았습니다', W / 2, 896, `300 44px ${FONT.hahmlet}`, C.hanji, seg(t, 1.25, 1.95), { align: 'center', spacing: 3, alpha: fade })
    const kl = seg(t, 1.6, 2.1)
    if (kl > 0) {
      const hw = 120 * ease.out3(kl)
      lineA(W / 2 - hw, 946, W / 2 + hw, 946, C.gold, 1, 0.6 * fade)
    }
    revealText('감사합니다', W / 2, 1044, `300 72px ${FONT.hahmlet}`, C.hanji, seg(t, 1.65, 2.3), { align: 'center', spacing: 10, alpha: fade })
    vignette(0.72)
    const hd = 1 - ease.sine(seg(t, 0.5, 1.6))
    header(HEAD_L, HEAD_R, hd)
    disclaimer(hd)
    blackout(ease.sine(seg(t, 3.15, 3.5)))
    // 처음으로: 한지 창이 희미하게 다시 켜진다
    const gw = ease.sine(seg(t, 3.5, 3.95))
    if (gw > 0.003) relight(gw)
  },
}

export const scenes: Scene[] = [S15, S16, S17, S18, S19]
