import {
  C, FONT, H, TYPE_COL, W, clamp, clipRect, ctx, drawBlur, dust, ease, face, hair, hanji, header, layer, lerp, mono, rng, seg, setCtx, text, tmp, vignette,
  type Face, type Scene,
} from '../engine'

// 러너의 프리로드 샘플에 없는 1막 글자(분할 서브셋) — 첫 프레임에서 대체 글꼴로 그려지지 않도록 미리 요청
if (typeof document !== 'undefined' && document.fonts) {
  for (const f of [`200 40px ${FONT.serif}`, `400 40px ${FONT.serif}`]) void document.fonts.load(f, '四象形象分析墨光判讀室落點太陰少陽少陰太陽').catch(() => undefined)
}

/** 공통 무대: 한지 창 위치 (모든 막에서 재사용) */
export const WIN = { x: 150, y: 200, w: 780, h: 1180 }

/* ───────── 1막 공용 무대 ───────── */
/** 얼굴 중심(대기 화면의 먹점 얼굴) */
const FC = { x: 540, y: 760, w: 500 }
/** 장면별 전역 시작 시각 — 먼지·호흡이 장면 경계에서 끊기지 않도록 */
const T0 = { S01: 0, S02: 4, S03: 9 }
/** 천장 빛기둥: 창 위에 떨어지는 원뿔 — act2(S04)의 무대와 같은 규격이어야 S03→S04 컷이 이어진다 */
const BM = { cx: W / 2, topW: 120, botW: 800, h: 1420 }
/** 모든 막 공통 헤더 */
const HEAD_L = '墨光判讀室 · INK-LIGHT READING ROOM'
const HEAD_R = 'STANDBY'
const beamHalf = (y: number) => (BM.topW + (BM.botW - BM.topW) * clamp(y / BM.h)) / 2
/** 아래 캡션 기준선 */
const CAP = { kicker: 1488, title: 1592, ring: 1700, call: 1782 }

const frac = (v: number) => v - Math.floor(v)

/** ctx를 임시 레이어로 돌려 엔진 함수를 그 위에 그린다 */
function onLayer(fn: () => void, L = tmp()) {
  const main = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(main) }
  return L
}
/** 카메라 푸시: (px,py)를 중심으로 s배 */
function camera(s: number, fn: () => void, px = FC.x, py = FC.y) {
  ctx.save()
  ctx.translate(px, py); ctx.scale(s, s); ctx.translate(-px, -py)
  fn()
  ctx.restore()
}

/* ───── 캐시 레이어 (정적이라 1회만 굽는다) ───── */
let beamC: HTMLCanvasElement | null = null
/** 공기 중 빛기둥: 중첩 사다리꼴(가운데가 진함) + 가는 빛줄기(갓 레이) + 천장 광원. act2 stage()와 같은 레시피 */
function beamCache() {
  if (beamC) return beamC
  const P = layer()
  const S = layer()
  const r = rng(41)
  const trap = (x: CanvasRenderingContext2D, wf: number, a: number, xo = 0) => {
    const g = x.createLinearGradient(0, 0, 0, BM.h)
    g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.16, `rgba(240,176,92,${a * 0.6})`)
    g.addColorStop(0.5, `rgba(232,166,75,${a * 0.22})`); g.addColorStop(1, 'rgba(232,166,75,0)')
    x.fillStyle = g
    x.beginPath()
    x.moveTo(BM.cx + xo - (BM.topW / 2) * wf, 0); x.lineTo(BM.cx + xo + (BM.topW / 2) * wf, 0)
    x.lineTo(BM.cx + xo + (BM.botW / 2) * wf, BM.h); x.lineTo(BM.cx + xo - (BM.botW / 2) * wf, BM.h)
    x.closePath(); x.fill()
  }
  for (const [wf, a] of [[1, 0.2], [0.78, 0.18], [0.52, 0.18], [0.26, 0.2]] as const) trap(S.x, wf, a)
  P.x.filter = 'blur(34px)'; P.x.drawImage(S.c, 0, 0)
  S.x.clearRect(0, 0, W, H)
  for (let i = 0; i < 11; i++) trap(S.x, 0.05 + r() * 0.09, 0.1 + r() * 0.16, (r() - 0.5) * BM.topW * 0.8)
  P.x.filter = 'blur(7px)'; P.x.globalCompositeOperation = 'lighter'; P.x.drawImage(S.c, 0, 0)
  // 천장 광원
  P.x.filter = 'none'
  const g = P.x.createRadialGradient(BM.cx, -30, 0, BM.cx, -30, 260)
  g.addColorStop(0, 'rgba(255,226,170,0.55)'); g.addColorStop(0.4, 'rgba(255,200,120,0.16)'); g.addColorStop(1, 'rgba(255,200,120,0)')
  P.x.fillStyle = g
  P.x.fillRect(0, 0, W, 320)
  beamC = P.c
  return beamC
}

let winC: HTMLCanvasElement | null = null
/** 한지 창(glow=1) + 빛기둥이 떨어진 자리(위쪽이 더 밝고 따뜻, 원뿔 밖 모서리는 그늘) */
function winCache() {
  if (winC) return winC
  const P = layer()
  onLayer(() => hanji(WIN.x, WIN.y, WIN.w, WIN.h, 1), P)
  // 원뿔 밖 그늘(곱하기)
  const S = layer()
  S.x.fillStyle = 'rgba(70,52,30,0.5)'
  S.x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h)
  S.x.globalCompositeOperation = 'destination-out'
  S.x.filter = 'blur(40px)'
  S.x.fillStyle = '#000'
  S.x.beginPath()
  S.x.moveTo(BM.cx - beamHalf(0) * 1.1, 0); S.x.lineTo(BM.cx + beamHalf(0) * 1.1, 0)
  S.x.lineTo(BM.cx + beamHalf(BM.h) * 1.1, BM.h); S.x.lineTo(BM.cx - beamHalf(BM.h) * 1.1, BM.h)
  S.x.closePath(); S.x.fill()
  const vg = S.x.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h)
  S.x.filter = 'none'
  S.x.globalCompositeOperation = 'destination-in'
  vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.55, 'rgba(0,0,0,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0.15)')
  S.x.fillStyle = vg
  S.x.fillRect(0, 0, W, H)
  P.x.save()
  P.x.beginPath(); P.x.rect(WIN.x, WIN.y, WIN.w, WIN.h); P.x.clip()
  P.x.globalCompositeOperation = 'multiply'
  P.x.drawImage(S.c, 0, 0)
  // 빛이 닿은 윗부분: 따뜻한 스크린
  P.x.globalCompositeOperation = 'screen'
  const hg = P.x.createRadialGradient(BM.cx, WIN.y - 60, 0, BM.cx, WIN.y - 60, 560)
  hg.addColorStop(0, 'rgba(255,214,150,0.55)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.16)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
  P.x.fillStyle = hg
  P.x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h)
  // 창틀 안쪽 그림자(깊이감)
  P.x.globalCompositeOperation = 'multiply'
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = P.x.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, 'rgba(90,70,45,0.55)'); g.addColorStop(1, 'rgba(90,70,45,0)')
    P.x.fillStyle = g; P.x.fillRect(rx, ry, rw, rh)
  }
  edge(WIN.x, 0, WIN.x + 22, 0, WIN.x, WIN.y, 22, WIN.h)
  edge(WIN.x + WIN.w, 0, WIN.x + WIN.w - 22, 0, WIN.x + WIN.w - 22, WIN.y, 22, WIN.h)
  edge(0, WIN.y + WIN.h, 0, WIN.y + WIN.h - 26, WIN.x, WIN.y + WIN.h - 26, WIN.w, 26)
  P.x.restore()
  winC = P.c
  return winC
}

let lineC: HTMLCanvasElement | null = null
/** 창 윗변에 빛이 닿아 그어지는 선(미리 블룸을 구워 둔다) */
function strikeCache() {
  if (lineC) return lineC
  const P = layer()
  const S = layer()
  const g = S.x.createLinearGradient(WIN.x, 0, WIN.x + WIN.w, 0)
  g.addColorStop(0, 'rgba(255,214,150,0.05)'); g.addColorStop(0.32, 'rgba(255,220,160,0.6)'); g.addColorStop(0.5, 'rgba(255,240,210,1)')
  g.addColorStop(0.68, 'rgba(255,220,160,0.6)'); g.addColorStop(1, 'rgba(255,214,150,0.05)')
  S.x.fillStyle = g
  S.x.fillRect(WIN.x, WIN.y - 1.5, WIN.w, 3)
  P.x.globalCompositeOperation = 'lighter'
  for (const [b, a] of [[22, 0.7], [6, 0.9], [0, 1]] as const) { P.x.filter = b ? `blur(${b}px)` : 'none'; P.x.globalAlpha = a; P.x.drawImage(S.c, 0, 0) }
  lineC = P.c
  return lineC
}

/** 빛기둥(스크린 합성). descent<1이면 위에서부터 내려오는 중 */
function beamFx(k: number, descent = 1) {
  if (k <= 0) return
  const P = beamCache()
  if (descent >= 1) { drawBlur(P, 0, k, 'screen'); return }
  const L = tmp()
  L.x.drawImage(P, 0, 0)
  L.x.globalCompositeOperation = 'destination-in'
  const cut = lerp(-60, BM.h + 400, descent)
  const g = L.x.createLinearGradient(0, cut - 420, 0, cut)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  L.x.fillStyle = g
  L.x.fillRect(0, 0, W, H)
  drawBlur(L.c, 0, k, 'screen')
}
/** 먹 위의 빛기둥: 짙은 먹은 공기 중 산란광까지 덜 받아 보이게(먹의 검정이 갈색으로 뜨지 않도록) */
function beamOverInk(mask: HTMLCanvasElement | null, hold = 0.8) {
  if (!mask || hold <= 0) { beamFx(1); return }
  const L = tmp()
  L.x.drawImage(beamCache(), 0, 0)
  L.x.globalCompositeOperation = 'destination-out'
  L.x.globalAlpha = hold
  L.x.drawImage(mask, 0, 0)
  drawBlur(L.c, 0, 1, 'screen')
}
/** 한지 창. reveal<1: 빛이 닿은 윗변 가운데서부터 번져 켜진다. blur: 랙 포커스 */
function windowFx(glow: number, reveal = 1, blur = 0) {
  if (glow <= 0) return
  const P = winCache()
  if (reveal >= 1) { drawBlur(P, blur, glow); return }
  const L = tmp()
  L.x.drawImage(P, 0, 0)
  L.x.globalCompositeOperation = 'destination-in'
  const R = lerp(0, 1650, reveal)
  const g = L.x.createRadialGradient(BM.cx, WIN.y - 40, Math.max(0, R - 520), BM.cx, WIN.y - 40, R + 1)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  L.x.fillStyle = g
  L.x.fillRect(0, 0, W, H)
  drawBlur(L.c, blur, glow)
}
/** 윗변 빛선: k 0→1 가운데서 양쪽으로 그어진다 */
function strikeFx(k: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const half = (WIN.w / 2 + 30) * ease.out3(k)
  ctx.save()
  ctx.beginPath(); ctx.rect(BM.cx - half, 0, half * 2, WIN.y + 80); ctx.clip()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(strikeCache(), 0, 0)
  ctx.restore()
}
/** 빛기둥 속 먼지(전역 시각 T) */
function dustFx(T: number, alpha = 1, descent = 1) {
  if (alpha <= 0) return
  const h = lerp(0, BM.h * 0.95, descent)
  if (h < 10) return
  dust(BM.cx, BM.topW * 0.9, BM.topW + (BM.botW - BM.topW) * (h / BM.h) * 0.9, h, Math.round(760 * (h / BM.h) + 80), T, 5, '255,214,150', alpha)
}

/** 렌즈 가까이 떠다니는 큰 먼지 보케(C): 빛기둥 윗부분에만 */
function motes(T: number, alpha = 1) {
  if (alpha <= 0) return
  const r = rng(77)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 7; i++) {
    const y0 = 60 + r() * 520, sp = 3 + r() * 5, ph = r() * 6.283
    const y = y0 + ((T * sp) % 160) - 80
    const x = BM.cx + (r() - 0.5) * beamHalf(y) * 1.5 + Math.sin(T * 0.3 + ph) * 12
    const rr = 16 + r() * 30
    const a = (0.05 + r() * 0.07) * alpha * clamp(1 - Math.abs(y - y0) / 80)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr)
    g.addColorStop(0, `rgba(255,214,150,${a * 0.6})`); g.addColorStop(0.82, `rgba(255,214,150,${a})`); g.addColorStop(1, 'rgba(255,214,150,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill()
  }
  ctx.restore()
}

/** 잔광: S19 마지막(act6 relight(1))과 같은 그림 — 희미하게 다시 켜진 창에서 루프가 시작된다 */
function ember(k: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const L = onLayer(() => hanji(WIN.x, WIN.y, WIN.w, WIN.h, 1, { halo: false }))
  L.x.globalCompositeOperation = 'destination-in'
  const R = lerp(120, 900, ease.out3(k))
  const g = L.x.createRadialGradient(W / 2, WIN.y - 40, 0, W / 2, WIN.y - 40, R)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  L.x.fillStyle = g
  L.x.fillRect(0, 0, W, H)
  drawBlur(L.c, 2, 0.2 * k * alpha)
  const hw = (WIN.w / 2) * ease.out3(k)
  ctx.save()
  const lg = ctx.createLinearGradient(W / 2 - hw, 0, W / 2 + hw, 0)
  lg.addColorStop(0, 'rgba(255,214,150,0)'); lg.addColorStop(0.5, `rgba(255,226,176,${0.42 * k * alpha})`); lg.addColorStop(1, 'rgba(255,214,150,0)')
  ctx.fillStyle = lg
  ctx.fillRect(W / 2 - hw, WIN.y - 1, hw * 2, 2)
  ctx.restore()
}

/* ───── 캡션 ───── */
/** 글자별로 번져 나오는 텍스트(가운데 정렬). k 0→1 */
function inkText(s: string, cx: number, y: number, font: string, color: string, k: number, spacing = 0, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  ctx.save(); ctx.font = font
  const chars = [...s]
  const ws = chars.map((ch) => ctx.measureText(ch).width)
  ctx.restore()
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  const n = chars.length
  chars.forEach((ch, i) => {
    const kk = clamp(k * (1 + (n - 1) * 0.12) - i * 0.12)
    if (ch !== ' ' && kk > 0) text(ch, x, y, font, color, { alpha: ease.sine(kk) * alpha, blur: (1 - ease.out3(kk)) * 9 })
    x += ws[i] + spacing
  })
}
function kicker(alpha: number) {
  text('四象 形象 分析', W / 2, CAP.kicker, `200 40px ${FONT.serif}`, C.hanji, { align: 'center', spacing: 22, alpha: alpha * 0.78 })
}

/* ───── 먹 ───── */
const HARM = [[2, 0.03], [3, 0.035], [5, 0.025], [8, 0.018], [13, 0.013], [21, 0.01], [34, 0.008], [55, 0.006], [89, 0.005]] as const
/** 얼룩 윤곽의 반지름 배율(각도 a) */
function blobM(a: number, ph: number[], amp: number) {
  let m = 1
  HARM.forEach(([h, aa], j) => { m += amp * aa * Math.sin(h * a + ph[j]) })
  return m
}
function blobPath(x: CanvasRenderingContext2D, cx: number, cy: number, R: number, ph: number[], amp: number, n = 220) {
  x.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = R * blobM(a, ph, amp)
    if (i === 0) x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96)
    else x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96)
  }
  x.closePath()
}
/**
 * 한지에 번지는 먹. k: 0(닿는 순간)→1(번짐 끝). 난수 소비량이 k와 무관 → 같은 얼룩이 자란다.
 * 세 겹: O(물번짐·반영, 크게 흐림) / S(젖은 먹이 겹겹이 쌓인 농담, 중간 흐림) / L(경계·조수선·과립·실번짐, 거의 선명)
 */
function inkStain(cx: number, cy: number, R: number, k: number, alpha = 1, seed = 21) {
  if (k <= 0 || alpha <= 0) return
  const r = rng(seed)
  const phs = () => HARM.map(() => r() * 6.283)
  const e = ease.ink(k)
  const Rk = Math.max(3, R * e)
  const O = tmp()
  const S = tmp()
  const L = tmp()
  // 물번짐: 안료보다 앞서 나간 연한 물 띠
  blobPath(O.x, cx, cy, Rk * 1.13 + 6, phs(), 1.3)
  const go = O.x.createRadialGradient(cx, cy, Rk * 0.7, cx, cy, Rk * 1.16 + 6)
  go.addColorStop(0, 'rgba(70,60,46,0.22)'); go.addColorStop(1, 'rgba(70,60,46,0.1)')
  O.x.fillStyle = go; O.x.fill()
  // 안료 경계(바깥 윤곽) — 같은 윤곽으로 반영(흐린 가장자리)과 선명한 본체를 함께 만든다
  const ph0 = phs(), amp0 = 0.9 + 0.35 * k
  const edgeR = (a: number) => Rk * blobM(a, ph0, amp0)
  blobPath(O.x, cx, cy, Rk * 1.025, ph0, amp0)
  O.x.fillStyle = 'rgba(14,15,17,0.2)'; O.x.fill()
  blobPath(L.x, cx, cy, Rk, ph0, amp0)
  const gb = L.x.createRadialGradient(cx, cy, 0, cx, cy, Rk * 1.06)
  gb.addColorStop(0, 'rgba(12,13,15,0.28)'); gb.addColorStop(0.78, 'rgba(14,15,17,0.2)'); gb.addColorStop(0.95, 'rgba(14,15,17,0.27)'); gb.addColorStop(1, 'rgba(10,11,12,0.38)')
  L.x.fillStyle = gb; L.x.fill()
  // 조수선: 끊기며 이어지는 가는 진한 테
  L.x.save()
  L.x.setLineDash([18 + r() * 30, 6 + r() * 14, 40 + r() * 50, 10 + r() * 10])
  L.x.lineDashOffset = r() * 100
  L.x.strokeStyle = 'rgba(10,11,12,0.34)'; L.x.lineWidth = 1.8; L.x.stroke()
  L.x.restore()
  // 젖은 먹이 겹겹이: 안쪽으로 갈수록 짙어지는 농담 층(각자 다른 윤곽)
  for (const [f, a] of [[0.9, 0.12], [0.75, 0.15], [0.6, 0.18], [0.45, 0.23], [0.3, 0.3]] as const) {
    const ox = (r() - 0.5) * Rk * 0.1, oy = (r() - 0.5) * Rk * 0.1
    blobPath(S.x, cx + ox, cy + oy, Rk * f, phs(), 1.7)
    S.x.fillStyle = `rgba(11,12,14,${a})`; S.x.fill()
  }
  // 농담 얼룩(경계 없는 부드러운 덩어리)
  for (let j = 0; j < 7; j++) {
    const ox = cx + (r() - 0.5) * Rk * 0.9, oy = cy + (r() - 0.5) * Rk * 0.9, rr = Rk * (0.14 + r() * 0.26)
    const gg = S.x.createRadialGradient(ox, oy, 0, ox, oy, rr)
    gg.addColorStop(0, `rgba(10,11,12,${0.1 + r() * 0.14})`); gg.addColorStop(1, 'rgba(10,11,12,0)')
    S.x.fillStyle = gg; S.x.beginPath(); S.x.arc(ox, oy, rr, 0, 6.283); S.x.fill()
  }
  // 떨어진 자리 둘레의 짙은 먹(부드럽게)
  const gc = S.x.createRadialGradient(cx, cy, 0, cx, cy, Rk * 0.44)
  gc.addColorStop(0, 'rgba(8,9,10,0.72)'); gc.addColorStop(0.5, 'rgba(8,9,10,0.36)'); gc.addColorStop(1, 'rgba(8,9,10,0)')
  S.x.fillStyle = gc; S.x.beginPath(); S.x.arc(cx, cy, Rk * 0.44, 0, 6.283); S.x.fill()
  // 과립: 섬유에 걸린 먹 입자 — 평평한 회색 대신 종이결이 읽히게
  for (let i = 0; i < 900; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 0.97 * edgeR(a), s = 0.5 + r() * 1.2, al = 0.05 + r() * 0.16
    L.x.fillStyle = `rgba(8,9,10,${al})`
    L.x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.96, s, s)
  }
  // 섬유를 타고 뻗는 실번짐(실제 경계에서 바깥으로)
  L.x.lineCap = 'round'
  for (let i = 0; i < 460; i++) {
    const a0 = r() * 6.283
    const rb = edgeR(a0) * (0.93 + r() * 0.07)
    let x = cx + Math.cos(a0) * rb, y = cy + Math.sin(a0) * rb * 0.96
    let a = a0 + (r() - 0.5) * 1.5
    const len = (4 + r() * (r() < 0.18 ? 58 : 16)) * (0.3 + 0.7 * e)
    L.x.strokeStyle = `rgba(12,13,15,${0.08 + r() * 0.26})`
    L.x.lineWidth = 0.35 + r() * 0.8
    L.x.beginPath(); L.x.moveTo(x, y)
    for (let st = 0; st < 5; st++) {
      a += (r() - 0.5) * 0.7
      x += (Math.cos(a) * len) / 5; y += (Math.sin(a) * len) / 5
      L.x.lineTo(x, y)
    }
    L.x.stroke()
  }
  // 튄 먹점(닿는 순간 사방으로)
  const sp = ease.out3(clamp(k * 14))
  for (let i = 0; i < 12; i++) {
    const a = r() * 6.283, d = (R * 0.3 + r() * R * 0.55) * sp, sz = 1 + r() * 2.4
    L.x.fillStyle = `rgba(10,11,12,${0.6 + r() * 0.3})`
    L.x.beginPath(); L.x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.96, sz, 0, 6.283); L.x.fill()
  }
  // 떨어진 자리(진한 심)
  blobPath(L.x, cx, cy, 14 + 22 * e, phs(), 3)
  L.x.fillStyle = `rgba(7,8,9,${0.82 - 0.3 * k})`
  L.x.fill()
  drawBlur(O.c, 10, alpha)
  drawBlur(S.c, 6, alpha)
  drawBlur(L.c, 0.8 + 0.8 * k, alpha)
}
let stainC: HTMLCanvasElement | null = null
/** 번짐이 끝난(k=1) 얼룩 캐시 — S03 응축의 출발점 */
function stainCache() {
  if (stainC) return stainC
  const P = layer()
  onLayer(() => inkStain(FC.x, FC.y, STAIN_R, 1), P)
  stainC = P.c
  return stainC
}
const STAIN_R = 270

/** 떨어지는 먹 방울(슬로모션). 위는 앰버 빛기둥 림, 아래는 한지 역광 굴절 */
function inkDropFx(x: number, y: number, r: number, T: number, o: { squash?: number; alpha?: number; back?: number } = {}) {
  const a = o.alpha ?? 1
  if (a <= 0) return
  const sq = o.squash ?? 0
  const wob = 0.05 * Math.sin(T * 7.5)
  const sx = (1 + wob) * (1 + sq * 1.3), sy = (1 - wob) * (1 - sq * 0.78)
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y)
  ctx.scale(sx, sy)
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.05, 0, 0, r)
  g.addColorStop(0, '#3b3026'); g.addColorStop(0.42, '#0e0f11'); g.addColorStop(1, '#030304')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill()
  // 위쪽 림: 앰버(빛기둥)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,208,138,0.85)'
  ctx.lineWidth = r * 0.09
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke()
  // 아래쪽 굴절: 한지 역광
  const back = o.back ?? 0
  if (back > 0) {
    ctx.strokeStyle = `rgba(251,242,222,${0.55 * back})`
    ctx.lineWidth = r * 0.07
    ctx.beginPath(); ctx.arc(0, 0, r * 0.86, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke()
  }
  // 정반사 점
  ctx.shadowColor = 'rgba(255,220,160,1)'
  ctx.shadowBlur = r * 0.8
  ctx.fillStyle = 'rgba(255,246,228,0.95)'
  ctx.beginPath(); ctx.ellipse(-r * 0.34, -r * 0.44, r * 0.15, r * 0.1, -0.6, 0, 6.283); ctx.fill()
  ctx.restore()
}

/* ───── 먹점 얼굴(엔진 drawFace 'ink'와 같은 화법 + 응축·체형 변형·석채 림) ───── */
type Morph = { sx: number; taper: number; sy: number }
const NEUTRAL: Morph = { sx: 1, taper: 0, sy: 1 }
/** 체질 원형(형상 힌트): sx 폭, taper(+면 위가 넓고 턱이 좁음), sy 길이 */
const ARCH: Record<'taeeum' | 'soyang' | 'soeum', Morph> = {
  taeeum: { sx: 1.13, taper: -0.05, sy: 1.03 }, // 넓고 듬직
  soyang: { sx: 1.04, taper: 0.12, sy: 1.0 }, // 위가 넓고 턱이 좁음
  soeum: { sx: 0.88, taper: -0.01, sy: 0.98 }, // 좁고 단정
}
const mixM = (a: Morph, b: Morph, k: number): Morph => ({ sx: lerp(a.sx, b.sx, k), taper: lerp(a.taper, b.taper, k), sy: lerp(a.sy, b.sy, k) })
function rgbOf(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }

function inkFace(f: Face, o: { gather?: number; R?: number; morph?: Morph; tint?: string; tintK?: number; alpha?: number } = {}) {
  const g = o.gather ?? 1
  const m = o.morph ?? NEUTRAL
  const alpha = o.alpha ?? 1
  const R = o.R ?? STAIN_R
  const tk = o.tintK ?? 0
  const tc = o.tint ? rgbOf(o.tint) : [12, 13, 15]
  const L = tmp()
  const Wl = tmp()
  // 입 주변(웃는 인상 완화)
  const mx = (f.lm[61].x + f.lm[291].x) / 2, my = (f.lm[13].y + f.lm[14].y) / 2, mw = Math.abs(f.lm[291].x - f.lm[61].x) / 2
  for (const p of f.pts) {
    const v = (p.y - f.cy) / f.ry
    let x = f.cx + (p.x - f.cx) * (m.sx - m.taper * v)
    let y = f.cy + (p.y - f.cy) * m.sy
    let ap = 1
    if (g < 1) {
      const d = clamp((g - p.r * 0.45) / 0.55)
      if (d <= 0) continue
      const k = ease.ink(d)
      const ang = frac(p.r * 7919.37) * 6.283
      const dist = Math.sqrt(frac(p.r * 104.729)) * R * 0.92
      const lx = lerp(f.cx + Math.cos(ang) * dist, x, k) - f.cx
      const ly = lerp(f.cy + Math.sin(ang) * dist * 0.95, y, k) - f.cy
      // 먹이 소용돌이치며 거두어진다
      const sw = (1 - k) * 0.7, cs = Math.cos(sw), sn = Math.sin(sw)
      x = f.cx + lx * cs - ly * sn
      y = f.cy + lx * sn + ly * cs
      ap = clamp(d * 2.4)
    }
    const mu = ((p.x - mx) / (mw * 1.2)) ** 2 + ((p.y - my) / (mw * 0.42)) ** 2
    const calm = p.edge && mu < 1 ? 0.6 : 1
    const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5) * alpha * ap * calm
    const tf = tk > 0 ? tk * clamp((0.56 - p.s) / 0.2) * (p.edge ? 0.95 : 0.7) : 0
    if (p.r < 0.13) {
      // 담묵 음영(얼굴 둘레·눈두덩이 쪽이 짙다)
      Wl.x.fillStyle = `rgba(28,24,20,${(0.018 + (1 - p.s) ** 2 * 0.11) * alpha * ap})`
      Wl.x.beginPath(); Wl.x.arc(x, y, 7 + p.r * 60, 0, 6.283); Wl.x.fill()
    }
    const cr = Math.round(lerp(12, tc[0], tf)), cg = Math.round(lerp(13, tc[1], tf)), cb = Math.round(lerp(15, tc[2], tf))
    L.x.fillStyle = `rgba(${cr},${cg},${cb},${a})`
    const rad = p.edge ? 1.4 + p.r * 1.6 : 0.8 + p.r * 0.9
    L.x.beginPath(); L.x.arc(x, y, rad, 0, 6.283); L.x.fill()
  }
  drawBlur(Wl.c, 10)
  if (o.tint && tk > 0.01) {
    // 석채가 테두리에서 안쪽으로 스며든 띠(벡터 외곽선이 아니라 종이에 밴 안료)
    const P = tmp()
    P.x.beginPath()
    OVAL.forEach((i, j) => {
      const q = f.lm[i], v = (q.y - f.cy) / f.ry
      const x = f.cx + (q.x - f.cx) * (m.sx - m.taper * v), y = f.cy + (q.y - f.cy) * m.sy
      if (j) P.x.lineTo(x, y); else P.x.moveTo(x, y)
    })
    P.x.closePath()
    P.x.clip()
    P.x.strokeStyle = o.tint; P.x.lineWidth = 48; P.x.stroke()
    drawBlur(P.c, 16, 0.34 * tk * alpha, 'multiply')
  }
  drawBlur(L.c, 5, 0.5) // 먹 번짐
  ctx.drawImage(L.c, 0, 0)
}
/** 얼굴 외곽(실루엣) 랜드마크 순서 */
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

/* ───────── S01 ───────── */
const S01: Scene = {
  id: 'S01',
  act: '대기',
  title: '암전, 그리고 창이 켜진다',
  note: '거의 완전한 어둠 — 지난 관람의 잔광처럼 한지 창만 희미하게 숨 쉰다(S19에서 이어짐). 천장의 앰버 빛기둥이 천천히 내려와 창 윗변에 한 줄의 빛을 긋고, 창은 빛이 닿은 자리에서부터 번지듯 켜지며 빛 속에 먼지가 떠다닌다.',
  dur: 4,
  render(t) {
    const T = T0.S01 + t
    const kBeam = ease.sine(seg(t, 0.25, 1.5))
    const descent = ease.sine(seg(t, 0.25, 2.3))
    const kStrike = seg(t, 1.05, 1.9)
    const kWin = ease.sine(seg(t, 1.35, 3.6))
    const reveal = ease.ink(seg(t, 1.3, 3.7))
    windowFx(0.92 * kWin, reveal)
    beamFx(kBeam, descent)
    strikeFx(kStrike, 1 - 0.55 * ease.sine(seg(t, 2.0, 3.6)))
    dustFx(T, kBeam, descent)
    motes(T, kBeam * descent)
    vignette(0.7)
    // S19 끝의 잔광: 빛기둥이 닿기 전 한 번 가라앉았다가, 켜지는 창에 흡수된다
    ember(1, (1 - 0.35 * ease.sine(seg(t, 0.15, 1.1))) * (1 - ease.sine(seg(t, 1.3, 2.8))))
    header(HEAD_L, HEAD_R, seg(t, 2.6, 3.8))
    kicker(ease.sine(seg(t, 3, 4)))
  },
}

/* ───────── S02 ───────── */
const IMPACT = 2.3 // S02 안에서 먹 방울이 한지에 닿는 시각
const S02: Scene = {
  id: 'S02',
  act: '대기',
  title: '먹 한 방울',
  note: '슬로모션으로 먹 방울 하나가 빛기둥을 지나 떨어지고, 왼쪽 청자 눈금자가 남은 거리를 잰다. 초점이 방울을 따라갔다가 닿는 순간 한지로 돌아오며, 먹이 섬유를 타고 천천히 번진다.',
  dur: 5,
  render(t) {
    const T = T0.S02 + t
    const push = 1 + 0.05 * ease.sine(seg(t, 0.6, 5))
    // 랙 포커스: 방울이 앞으로 들어오면 창이 흐려지고, 닿기 직전 한지로 초점 복귀
    const blur = 7 * ease.sine(seg(t, 0.35, 1.1)) * (1 - ease.sine(seg(t, 1.75, IMPACT)))
    const kf = seg(t, 0.3, IMPACT)
    const dropY = lerp(-60, FC.y, 0.5 * kf + 0.5 * kf * kf)
    const kStain = seg(t, IMPACT, 5)
    const SL = kStain > 0 ? onLayer(() => clipRect(WIN.x, WIN.y, WIN.w, WIN.h, () => inkStain(FC.x, FC.y, STAIN_R, kStain))) : null
    camera(push, () => {
      windowFx(0.92, 1, blur)
      if (SL) ctx.drawImage(SL.c, 0, 0)
      beamOverInk(SL ? SL.c : null)
      strikeFx(1, 0.45)
      // 낙하 측정자(왼쪽 여백): 빛이 선을 긋고, 앰버 표식이 방울을 따라 내려간다
      const kr = ease.sine(seg(t, 0.4, 1.4)) * (1 - ease.sine(seg(t, 3.2, 4.4)))
      if (kr > 0) {
        const rx = 104
        const y1 = lerp(WIN.y, WIN.y + WIN.h, ease.out3(seg(t, 0.4, 1.5)))
        hair(rx, WIN.y, rx, y1, C.celadon, 1, 0.55 * kr)
        for (let i = 0; i <= 40; i++) {
          const yy = WIN.y + (WIN.h * i) / 40
          if (yy > y1) break
          hair(rx, yy, rx + (i % 5 === 0 ? 16 : 7), yy, C.celadon, 1, (i % 5 === 0 ? 0.6 : 0.35) * kr)
        }
        const my = clamp(dropY, WIN.y, FC.y)
        const hit = t >= IMPACT
        hair(rx - 12, my, rx + 26, my, hit ? C.amberCore : C.amber, 2, kr)
        const rem = Math.max(0, FC.y - dropY)
        mono(hit ? '0000' : String(Math.round(rem)).padStart(4, '0'), rx - 18, my + 5, hit ? C.amberCore : C.amber, 15, 'right', kr)
        mono('落', rx + 4, WIN.y - 16, C.celadon, 15, 'left', 0.7 * kr)
      }
      // 낙점 조준선(청자): 닿기 직전 맺히고 번짐 속에 사라진다
      const kc = ease.out3(seg(t, 1.5, 2.1)) * (1 - ease.sine(seg(t, 2.6, 3.4)))
      if (kc > 0) {
        const gap = lerp(70, 34, kc), len = 46
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) hair(FC.x + dx * gap, FC.y + dy * gap, FC.x + dx * (gap + len), FC.y + dy * (gap + len), C.celadonDeep, 1.4, kc * 0.9)
        mono('落點 540 · 760', FC.x + 92, FC.y - 12, C.celadonDeep, 16, 'left', kc * 0.9)
      }
      // 닿는 순간 한지가 떨리듯 퍼지는 청자 고리
      const kRing = seg(t, IMPACT, IMPACT + 1.1)
      if (kRing > 0 && kRing < 1) {
        ctx.save()
        ctx.strokeStyle = C.celadonDeep
        ctx.globalAlpha = 0.6 * (1 - ease.sine(kRing))
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.ellipse(FC.x, FC.y, lerp(26, 330, ease.out3(kRing)), lerp(26, 330, ease.out3(kRing)) * 0.96, 0, 0, 6.283); ctx.stroke()
        ctx.restore()
      }
      // 먹 방울
      if (t >= 0.3 && t < IMPACT + 0.16) {
        const sq = ease.out3(seg(t, IMPACT - 0.02, IMPACT + 0.14))
        const back = clamp((dropY - WIN.y + 20) / 60)
        inkDropFx(FC.x, dropY, 22, T, { squash: sq, alpha: 1 - seg(t, IMPACT + 0.04, IMPACT + 0.16), back })
        // 꼬리 위성 방울
        const ty = dropY - 78 - 10 * Math.sin(T * 3)
        if (t > 0.7 && t < IMPACT + 0.05) inkDropFx(FC.x + 1, ty, 5.5, T + 1, { alpha: seg(t, 0.7, 0.9) * (1 - seg(t, IMPACT - 0.05, IMPACT + 0.05)), back: clamp((ty - WIN.y) / 60) })
      }
    })
    dustFx(T)
    motes(T)
    vignette(0.7)
    header(HEAD_L, HEAD_R)
    kicker(1)
  },
}

/* ───────── S03 ───────── */
type Arch = keyof typeof ARCH
const CYCLE: { k: Arch; a: number; b: number }[] = [
  { k: 'taeeum', a: 2.55, b: 3.4 },
  { k: 'soyang', a: 3.4, b: 4.25 },
  { k: 'soeum', a: 4.25, b: 5.1 },
]
const LABELS: { k: Arch | 'taeyang'; s: string }[] = [
  { k: 'taeeum', s: '太陰' }, { k: 'soyang', s: '少陽' }, { k: 'soeum', s: '少陰' }, { k: 'taeyang', s: '太陽' },
]
/** t에서의 체형(이전 원형 → 다음 원형 보간)과 각 원형의 활성도 */
function archAt(t: number) {
  let m = NEUTRAL
  const act: Record<string, number> = { taeeum: 0, soyang: 0, soeum: 0, taeyang: 0 }
  let prev = NEUTRAL
  for (const c of CYCLE) {
    const k = ease.sine(seg(t, c.a, c.a + 0.4))
    if (t >= c.a) { m = mixM(prev, ARCH[c.k], k); act[c.k] = k; for (const o of CYCLE) if (o.k !== c.k) act[o.k] *= 1 - k }
    prev = ARCH[c.k]
  }
  const back = ease.sine(seg(t, 5.1, 5.55))
  if (t >= 5.1) { m = mixM(ARCH.soeum, NEUTRAL, back); act.soeum *= 1 - back }
  return { m, act }
}

const S03: Scene = {
  id: 'S03',
  act: '대기',
  title: '먹이 얼굴이 되다',
  note: '번진 먹이 소용돌이치며 거두어져 한지 위에 먹점 얼굴로 맺힌다. 얼굴이 태음·소양·소음의 형상으로 숨 쉬듯 바뀌며 석채색 테가 스치고, 아래에 제목과 맥동하는 “화면을 터치하세요”가 남는다(대기 루프).',
  dur: 6,
  render(t) {
    const T = T0.S03 + t
    const push = lerp(1.05, 1, ease.sine(seg(t, 0, 3.2)))
    const cond = ease.sine(seg(t, 0.15, 2.3))
    const gather = seg(t, 0.1, 2.5)
    const f = face(FC.x, FC.y, FC.w)
    const { m, act } = archAt(t)
    // 지금 활성인 원형의 석채색
    let tint: string | undefined, tintK = 0
    for (const c of CYCLE) if (act[c.k] > tintK) { tintK = act[c.k]; tint = TYPE_COL[c.k] }
    // 번진 먹이 얼굴로 거두어진다(작아지며 옅어지는 얼룩)
    const SL = cond < 1 ? onLayer(() => clipRect(WIN.x, WIN.y, WIN.w, WIN.h, () => {
      const s = 1 - 0.2 * cond
      ctx.globalAlpha = 1 - cond
      ctx.translate(FC.x, FC.y); ctx.scale(s, s); ctx.translate(-FC.x, -FC.y)
      ctx.drawImage(stainCache(), 0, 0)
    })) : null
    camera(push, () => {
      windowFx(0.92)
      clipRect(WIN.x, WIN.y, WIN.w, WIN.h, () => {
        if (SL) ctx.drawImage(SL.c, 0, 0)
        inkFace(f, { gather, morph: m, tint, tintK: tintK * 0.9 })
      })
      beamOverInk(SL ? SL.c : null)
      strikeFx(1, 0.45)
      // 오른쪽 여백: 사상 원형 색인(세로쓰기). 태양은 판별 제외로 늘 흐림
      const kIdx = ease.sine(seg(t, 2.2, 3.0))
      if (kIdx > 0) {
        const x = 1005
        LABELS.forEach((lb, i) => {
          const y0 = 548 + i * 118
          const a = lb.k === 'taeyang' ? 0 : act[lb.k]
          const base = lb.k === 'taeyang' ? 0.22 : 0.42
          const col = lb.k === 'taeyang' ? C.hanjiShadow : a > 0.05 ? TYPE_COL[lb.k as Arch] : C.hanjiShadow
          vtextC(lb.s, x, y0, 30, col, (base + (1 - base) * a) * kIdx)
          if (a > 0.02) {
            // 이름표에서 얼굴 테두리까지 빛이 선을 긋는다
            const yy = y0 + 18
            const v = (yy - f.cy) / f.ry
            const rim = f.cx + f.rx * (m.sx - m.taper * v) * Math.sqrt(Math.max(0.05, 1 - v * v)) + 10
            const x0 = x - 30
            drawLineA(x0, yy, lerp(x0, rim, ease.out3(a)), yy, TYPE_COL[lb.k as Arch], 1.2, a * kIdx * 0.85)
            hair(x0 + 2, yy - 5, x0 + 2, yy + 5, TYPE_COL[lb.k as Arch], 1.2, a * kIdx)
          }
        })
        hair(1005, 520, 1005, 534, C.celadon, 1, 0.4 * kIdx)
        mono('形', 1005, 506, C.celadon, 15, 'center', 0.6 * kIdx)
      }
    })
    dustFx(T)
    motes(T, 1 - ease.sine(seg(t, 5.3, 6))) // S04 무대에는 큰 먼지 보케가 없다
    vignette(0.7)
    header(HEAD_L, HEAD_R)
    kicker(1)
    // 제목
    inkText('얼굴과 몸으로 읽는 체질', W / 2, CAP.title, `300 60px ${FONT.hahmlet}`, C.hanji, seg(t, 2.1, 3.5), 3)
    // 터치 안내: 숨 쉬듯 맥동
    const kc = ease.sine(seg(t, 3.5, 4.3))
    if (kc > 0) {
      const ph = (T - (T0.S03 + 3.5)) / 2.4
      const breath = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2)
      const rp = frac(ph)
      ctx.save()
      ctx.strokeStyle = `rgba(241,230,207,${0.5 * (1 - rp) * kc})`
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(W / 2, CAP.ring, 8 + 30 * ease.out3(rp), 0, 6.283); ctx.stroke()
      ctx.fillStyle = `rgba(241,230,207,${(0.55 + 0.4 * breath) * kc})`
      ctx.beginPath(); ctx.arc(W / 2, CAP.ring, 4.5, 0, 6.283); ctx.fill()
      ctx.restore()
      text('화면을 터치하세요', W / 2, CAP.call, `400 30px ${FONT.sans}`, C.hanji, { align: 'center', spacing: 10, alpha: (0.45 + 0.5 * breath) * kc })
    }
  },
}

/** 세로쓰기(가운데 정렬, 알파) */
function vtextC(s: string, x: number, y: number, size: number, color: string, alpha: number) {
  ;[...s].forEach((ch, i) => text(ch, x, y + i * size * 1.18, `400 ${size}px ${FONT.serif}`, color, { align: 'center', alpha }))
}
function drawLineA(x0: number, y0: number, x1: number, y1: number, color: string, w: number, alpha: number) {
  hair(x0, y0, x1, y1, color, w, alpha)
}

export const scenes: Scene[] = [S01, S02, S03]

