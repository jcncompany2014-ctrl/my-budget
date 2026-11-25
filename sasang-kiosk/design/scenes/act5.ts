/**
 * 5막 판독 — S12 렌즈 판독(1/3 형상), S13 문진 대조(2/3), S14 응집과 침묵(3/3)
 * S11의 마지막 프레임(족자 + 08번 문항)에서 족자 속 먹 초상으로 카메라가 밀고 들어가, 족자의 화심이 그대로 한지 창이 된다.
 * 확대경이 이마→눈→코→입술→턱을 차례로 짚으면 렌즈 속에서만 앰버 점구름이 2배로 맺히고(랙 포커스), 경통에 수치가 새겨진다.
 * 이어 창의 불이 낮아지며 창살 아홉 칸을 따라 글자 기둥이 위로 흐르고, 맞물리는 글자끼리 빛이 선을 긋는다.
 * 끝으로 모든 글자가 한 점의 빛으로 거두어지고, 2초의 어둠(사유의 방)이 남는다.
 */
import {
  C, FONT, H, TYPE_COL, W, clamp, ctx, disclaimer, drawBlur, dust, ease, face, hair, hanji, header, layer, lerp,
  rng, seg, setCtx, text, tmp, vignette, type Face, type Scene,
} from '../engine'
import { WIN } from './act1'
import { scenes as act4Scenes } from './act4'

/* ───────── 무대 치수 ───────── */
/** 판독 대상 얼굴(3·4막 렌즈와 같은 얼굴) */
const FC = { x: 540, y: 760, w: 480 }
/** 확대경: 유리 반지름, 경통 두께, 배율 */
const LR = 200
const BAR = 34
const RO = LR + BAR
const MAG = 2
/** S12 길이: 다섯 지점 × 약 0.8초 머묾 + 이동 + 밀고 들어가기 */
const S12_DUR = 6.5
/** 장면별 전역 시각(먼지 흐름 연속) */
const T0 = { S12: 0, S13: S12_DUR, S14: S12_DUR + 3.5 }
/** S11 족자(4막): 축척과 화심 */
const PS = 0.48
const SCR = { faceY: 357, top: 172, bot: 782, x: 360, w: 360 }
const toWorldY = (y: number) => FC.y + (y - SCR.faceY) / PS
/** 족자 화심을 판독 공간(창 좌표)으로 옮긴 사각형 */
const SCROLL_RECT = { x: FC.x + (SCR.x - FC.x) / PS, y: toWorldY(SCR.top), w: SCR.w / PS, h: (SCR.bot - SCR.top) / PS }
const PAPER = { x: WIN.x, y: WIN.y, w: WIN.w, h: Math.ceil(SCROLL_RECT.y + SCROLL_RECT.h) + 10 - WIN.y }
/** 아래 판독값 영역 */
const RD = { label: 1494, value: 1652, cap: 1730, lm: 1790 }
/** 왼쪽 위치 자 */
const RUL = { x: 112, y0: 420, y1: 1100 }
const HEAD_L = '墨光判讀室 · INK-LIGHT READING ROOM'

/* ───────── 로컬 도우미 ───────── */
function onLayer(fn: () => void, L = tmp()) {
  const main = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(main) }
  return L
}
/** 영역만 잘라 합성(전체 화면 블러보다 싸다). 현재 변환을 따른다 */
function blurRegion(src: HTMLCanvasElement, x: number, y: number, w: number, h: number, blur: number, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0) return
  const pad = Math.ceil(blur * 3) + 2
  const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad))
  const x1 = Math.min(W, Math.ceil(x + w + pad)), y1 = Math.min(H, Math.ceil(y + h + pad))
  if (x1 <= x0 || y1 <= y0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, alpha)
  ctx.globalCompositeOperation = op
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}
function lineA(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  hair(x0, y0, lerp(x0, x1, k), lerp(y0, y1, k), color, w, alpha)
}
function rgbOf(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
/** 두 '#RRGGBB' 색의 보간 → '#RRGGBB' (결과를 다시 섞을 수 있게 hex로 돌려준다) */
function mixHex(a: string, b: string, k: number) {
  const pa = rgbOf(a), pb = rgbOf(b)
  const h = (i: number) => Math.round(lerp(pa[i], pb[i], clamp(k))).toString(16).padStart(2, '0')
  return `#${h(0)}${h(1)}${h(2)}`
}
const rgba = (hex: string, a: number) => { const p = rgbOf(hex); return `rgba(${p[0]},${p[1]},${p[2]},${clamp(a)})` }
function measure(s: string, font: string, spacing = 0) {
  ctx.save(); ctx.font = font; ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(s).width
  ctx.restore()
  return w
}
/** 글자별로 먹이 맺히듯 나타나는 가로 텍스트. align center/left. k 0→1 */
function engrave(s: string, x: number, y: number, font: string, color: string, k: number, o: { align?: 'left' | 'center'; spacing?: number; alpha?: number; blur?: number; hot?: string } = {}) {
  const alpha = o.alpha ?? 1
  if (k <= 0 || alpha <= 0) return
  const sp = o.spacing ?? 0
  ctx.save(); ctx.font = font; ctx.letterSpacing = '0px'
  const chars = [...s]
  const ws = chars.map((ch) => ctx.measureText(ch).width)
  ctx.restore()
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)
  let xx = o.align === 'center' ? x - total / 2 : x
  const n = chars.length
  const st = Math.min(0.12, 1.4 / Math.max(1, n))
  chars.forEach((ch, i) => {
    const kk = clamp(k * (1 + (n - 1) * st) - i * st)
    if (ch !== ' ' && kk > 0) {
      const col = o.hot ? mixHex(o.hot, color, ease.sine(clamp(kk * 1.6 - 0.3))) : color
      text(ch, xx, y, font, col, { alpha: ease.sine(clamp(kk * 1.4)) * alpha, blur: (1 - ease.out3(kk)) * 7 + (o.blur ?? 0) })
    }
    xx += ws[i] + sp
  })
}
/** 한자는 명조로, 로마자·숫자는 고정폭으로 나눠 새긴다(고정폭 글꼴의 한자 대체 글꼴을 피한다) */
function engraveMixed(s: string, x: number, y: number, size: number, color: string, k: number, o: { alpha?: number; blur?: number; hot?: string } = {}) {
  const runs: { s: string; cjk: boolean }[] = []
  for (const ch of [...s]) {
    const cjk = /[㐀-鿿]/.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.cjk === cjk) last.s += ch
    else runs.push({ s: ch, cjk })
  }
  const total = [...s].length
  let xx = x, n0 = 0
  for (const r of runs) {
    const font = r.cjk ? `400 ${Math.round(size * 1.12)}px ${FONT.serif}` : `300 ${size}px ${FONT.mono}`
    const n = [...r.s].length
    engrave(r.s, xx, y + (r.cjk ? 1 : 0), font, color, clamp((k * total - n0) / n), o)
    xx += measure(r.s, font)
    n0 += n
  }
}
/** 원호를 따라 새긴 글자(렌즈 경통). top=true: 위쪽 호(바깥으로 서서), false: 아래쪽 호(안쪽으로 서서) */
function arcText(s: string, cx: number, cy: number, r: number, top: boolean, font: string, color: string, alpha: number, k = 1, hot?: string, spacing = 3) {
  if (alpha <= 0 || k <= 0) return
  ctx.save()
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const chars = [...s]
  const ws = chars.map((ch) => ctx.measureText(ch).width + spacing)
  const total = ws.reduce((a, b) => a + b, 0) - spacing
  const mid = top ? -Math.PI / 2 : Math.PI / 2
  let a = top ? mid - total / r / 2 : mid + total / r / 2
  const n = chars.length
  chars.forEach((ch, i) => {
    const w = ws[i] - spacing
    const ac = top ? a + w / 2 / r : a - w / 2 / r
    const kk = clamp(k * (n + 2) - i)
    if (kk > 0 && ch !== ' ') {
      ctx.save()
      ctx.translate(cx + Math.cos(ac) * r, cy + Math.sin(ac) * r)
      ctx.rotate(top ? ac + Math.PI / 2 : ac - Math.PI / 2)
      ctx.globalAlpha = alpha * ease.sine(clamp(kk * 1.5))
      ctx.fillStyle = hot ? mixHex(hot, color, ease.sine(kk)) : color
      ctx.fillText(ch, 0, 0)
      ctx.restore()
    }
    a = top ? a + ws[i] / r : a - ws[i] / r
  })
  ctx.restore()
}

/* ───────── 캐시 레이어(정적, 1회 굽기) ───────── */
let s11C: HTMLCanvasElement | null = null
/** S11 마지막 프레임. 화면에 붙은 머리띠·고지 띠는 지워 둔다(이 막이 같은 자리에 다시 그린다) */
function s11Cache() {
  if (s11C) return s11C
  const P = layer()
  const prev = act4Scenes.find((s) => s.id === 'S11')
  if (prev) {
    onLayer(() => {
      prev.render(prev.dur)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.filter = 'none'
      for (let i = 0; i < 2; i++) {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        header(HEAD_L, '問診 · SURVEY')
        disclaimer(1)
        ctx.restore()
      }
    }, P)
  }
  s11C = P.c
  return s11C
}
/** 먹점 얼굴(1·4막과 같은 화법) */
function inkPortrait(f: Face) {
  const L = tmp()
  const Wl = tmp()
  const mx = (f.lm[61].x + f.lm[291].x) / 2, my = (f.lm[13].y + f.lm[14].y) / 2, mw = Math.abs(f.lm[291].x - f.lm[61].x) / 2
  for (const p of f.pts) {
    const mu = ((p.x - mx) / (mw * 1.2)) ** 2 + ((p.y - my) / (mw * 0.42)) ** 2
    const calm = p.edge && mu < 1 ? 0.6 : 1
    const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5) * calm
    if (p.r < 0.13) {
      Wl.x.fillStyle = `rgba(28,24,20,${0.018 + (1 - p.s) ** 2 * 0.11})`
      Wl.x.beginPath(); Wl.x.arc(p.x, p.y, 7 + p.r * 60, 0, 6.283); Wl.x.fill()
    }
    L.x.fillStyle = `rgba(12,13,15,${a})`
    const rad = p.edge ? 1.4 + p.r * 1.6 : 0.8 + p.r * 0.9
    L.x.beginPath(); L.x.arc(p.x, p.y, rad, 0, 6.283); L.x.fill()
  }
  drawBlur(Wl.c, 10)
  drawBlur(L.c, 5, 0.5)
  ctx.drawImage(L.c, 0, 0)
}
let paperC: HTMLCanvasElement | null = null
/** 역광 한지(창 + 전환용으로 아래로 더 긴 면). 천장 빛이 닿은 위쪽은 따뜻하고, 창틀 안쪽은 그늘 */
function paperCache() {
  if (paperC) return paperC
  const P = layer()
  onLayer(() => hanji(PAPER.x, PAPER.y, PAPER.w, PAPER.h, 1, { halo: false }), P)
  const x = P.x
  x.save()
  x.beginPath(); x.rect(PAPER.x, PAPER.y, PAPER.w, PAPER.h); x.clip()
  x.globalCompositeOperation = 'screen'
  const hg = x.createRadialGradient(FC.x, WIN.y - 60, 0, FC.x, WIN.y - 60, 600)
  hg.addColorStop(0, 'rgba(255,214,150,0.5)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.14)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
  x.fillStyle = hg; x.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h)
  x.globalCompositeOperation = 'multiply'
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, a: number) => {
    const g = x.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, `rgba(90,70,45,${a})`); g.addColorStop(1, 'rgba(90,70,45,0)')
    x.fillStyle = g; x.fillRect(rx, ry, rw, rh)
  }
  edge(WIN.x, 0, WIN.x + 24, 0, WIN.x, WIN.y, 24, PAPER.h, 0.55)
  edge(WIN.x + WIN.w, 0, WIN.x + WIN.w - 24, 0, WIN.x + WIN.w - 24, WIN.y, 24, PAPER.h, 0.55)
  edge(0, WIN.y, 0, WIN.y + 18, WIN.x, WIN.y, WIN.w, 18, 0.4)
  // 아래로 갈수록 등불에서 멀어진다
  const vg = x.createLinearGradient(0, 760, 0, WIN.y + WIN.h)
  vg.addColorStop(0, 'rgba(150,122,86,0)'); vg.addColorStop(1, 'rgba(150,122,86,0.55)')
  x.fillStyle = vg; x.fillRect(PAPER.x, 760, PAPER.w, PAPER.h)
  x.restore()
  paperC = P.c
  return paperC
}
let haloC: HTMLCanvasElement | null = null
function haloCache() {
  if (haloC) return haloC
  const P = layer()
  P.x.filter = 'blur(90px)'
  P.x.fillStyle = C.hanji
  P.x.fillRect(WIN.x - 40, WIN.y - 40, WIN.w + 80, WIN.h + 80)
  haloC = P.c
  return haloC
}
let faceC: HTMLCanvasElement | null = null
function faceCache() {
  if (faceC) return faceC
  faceC = onLayer(() => inkPortrait(face(FC.x, FC.y, FC.w)), layer()).c
  return faceC
}
const BM = { cx: W / 2, topW: 230, botW: 860, h: 1420 }
let beamC: HTMLCanvasElement | null = null
/** 천장 빛기둥(1막과 같은 원뿔, 판독실은 조금 낮춘다) */
function beamCache() {
  if (beamC) return beamC
  const P = layer()
  const S = layer()
  const r = rng(41)
  const trap = (wf: number, a: number, xo = 0) => {
    const g = S.x.createLinearGradient(0, 0, 0, BM.h)
    g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.12, `rgba(244,184,104,${a * 0.6})`)
    g.addColorStop(0.3, `rgba(232,166,75,${a * 0.22})`); g.addColorStop(0.55, `rgba(232,166,75,${a * 0.06})`); g.addColorStop(1, 'rgba(232,166,75,0)')
    S.x.fillStyle = g
    S.x.beginPath()
    S.x.moveTo(BM.cx + xo - (BM.topW / 2) * wf, 0); S.x.lineTo(BM.cx + xo + (BM.topW / 2) * wf, 0)
    S.x.lineTo(BM.cx + xo + (BM.botW / 2) * wf, BM.h); S.x.lineTo(BM.cx + xo - (BM.botW / 2) * wf, BM.h)
    S.x.closePath(); S.x.fill()
  }
  for (const [wf, a] of [[1.08, 0.22], [0.8, 0.2], [0.55, 0.19], [0.3, 0.17]] as const) trap(wf, a)
  P.x.filter = 'blur(40px)'
  P.x.drawImage(S.c, 0, 0)
  S.x.clearRect(0, 0, W, H)
  for (let i = 0; i < 9; i++) trap(0.05 + r() * 0.08, 0.05 + r() * 0.06, (r() - 0.5) * BM.topW * 0.9)
  P.x.filter = 'blur(11px)'
  P.x.globalCompositeOperation = 'lighter'
  P.x.drawImage(S.c, 0, 0)
  P.x.filter = 'none'
  const g = P.x.createRadialGradient(BM.cx, -30, 0, BM.cx, -30, 260)
  g.addColorStop(0, 'rgba(255,226,170,0.55)'); g.addColorStop(0.4, 'rgba(255,200,120,0.16)'); g.addColorStop(1, 'rgba(255,200,120,0)')
  P.x.fillStyle = g
  P.x.fillRect(0, 0, W, 320)
  beamC = P.c
  return beamC
}

/** 한지 창: glow 등불 밝기, faceA 먹 초상, rect 창 사각형(전환 중엔 족자 화심에서 창으로) */
function windowFx(glow: number, faceA: number, rect: { x: number; y: number; w: number; h: number } = WIN, haloA = 1) {
  if (glow <= 0) return
  drawBlur(haloCache(), 0, 0.35 * glow * haloA)
  ctx.save()
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip()
  ctx.globalAlpha = clamp(glow)
  ctx.drawImage(paperCache(), 0, 0)
  if (faceA > 0) { ctx.globalAlpha = clamp(faceA); ctx.drawImage(faceCache(), 0, 0) }
  ctx.restore()
}
function beamFx(k: number) { if (k > 0) drawBlur(beamCache(), 0, k, 'screen') }
function dustFx(T: number, alpha: number) {
  if (alpha <= 0) return
  dust(BM.cx, BM.topW * 0.9, BM.botW * 0.86, BM.h * 0.95, 620, T, 5, '255,214,150', alpha)
}
/** 머리띠 오른쪽: 판독 단계 표기 (Cormorant 이탤릭 n / 3 + 한글) */
function stageTag(n: number, ko: string, alpha: number) {
  if (alpha <= 0) return
  const f = `400 21px ${FONT.sans}`
  const wk = measure(ko, f, 4)
  text(ko, W - 72, 96, f, C.ash, { align: 'right', spacing: 4, alpha })
  text(`${n} / 3`, W - 72 - wk - 16, 97, `italic 300 32px ${FONT.italic}`, C.gold, { align: 'right', alpha })
}

/* ───────── 확대경 ───────── */
type P2 = { x: number; y: number }
/** 판독 지점(원 얼굴 좌표) */
function stopPts(f: Face): P2[] {
  const l = f.lm
  return [
    { x: (l[10].x + l[9].x) / 2, y: lerp(l[10].y, l[9].y, 0.5) }, // 額: 髮際~眉間
    { x: (l[263].x + l[362].x) / 2, y: (l[263].y + l[362].y) / 2 }, // 目
    { x: (l[129].x + l[358].x) / 2, y: (l[129].y + l[358].y) / 2 + 6 }, // 鼻
    { x: l[0].x, y: (l[0].y + l[17].y) / 2 }, // 唇
    { x: lerp(lerp(l[172].x, l[149].x, 0.5), f.cx, 0.2), y: lerp(l[172].y, l[149].y, 0.5) - 14 }, // 頤 (렌즈가 얼굴을 더 담도록 안쪽으로)
  ]
}
/** 정지 시각: a 도착, d 출발 */
const STOP_T = [
  { a: 1.0, d: 1.95 },
  { a: 2.25, d: 3.1 },
  { a: 3.4, d: 4.25 },
  { a: 4.55, d: 5.4 },
  { a: 5.7, d: 99 },
]
const LENS_IN = 0.8
function eyeAngle(f: Face) {
  const o = f.lm[263], i = f.lm[362]
  return (Math.atan2(i.y - o.y, Math.abs(i.x - o.x)) * 180) / Math.PI
}
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
function stops(f: Face) {
  return [
    { hz: '三停', mark: '額', ring: '額 · FOREHEAD · LM 10 / 9', val: '0.27 : 0.33 : 0.39', sig: '', ko: '상정 : 중정 : 하정 — 얼굴 길이 대비', lm: 'LM 10 · 9 · 2 · 152' },
    { hz: '目尾角', mark: '目', ring: '目 · CANTHUS · LM 263 / 362', val: `${signed(eyeAngle(f))}°`, sig: '+0.6σ', ko: '눈꼬리 각 · 目 0.22', lm: 'LM 263 · 362 · 33 · 133' },
    { hz: '鼻廣', mark: '鼻', ring: '鼻 · ALA NASI · LM 129 / 358', val: '0.35', sig: '+3.0σ', ko: '코 너비 / 얼굴 너비', lm: 'LM 129 · 358 · 234 · 454' },
    { hz: '唇厚', mark: '唇', ring: '唇 · LABIUM · LM 0 / 17', val: '0.10', sig: '+0.8σ', ko: '입술 두께 / 얼굴 길이', lm: 'LM 0 · 17 · 10 · 152' },
    { hz: '頤', mark: '頤', ring: '頤 · MANDIBLE · LM 172 / 397', val: '0.80', sig: '+1.8σ', ko: '턱 너비 / 얼굴 너비', lm: 'LM 172 · 397 · 234 · 454' },
  ]
}
/** 렌즈 상태(S12 시각 t) */
function lensAt(f: Face, t: number) {
  const S = stopPts(f)
  let i = 0
  while (i < 4 && t >= STOP_T[i].d) i++
  let x = S[i].x, y = S[i].y, mv = 0
  if (i > 0 && t < STOP_T[i].a) {
    const k = ease.inOut3(seg(t, STOP_T[i - 1].d, STOP_T[i].a))
    x = lerp(S[i - 1].x, S[i].x, k); y = lerp(S[i - 1].y, S[i].y, k)
    mv = Math.sin(Math.PI * k)
  }
  // 랙 포커스: 떠나면서 초점이 서서히 풀리고(끊김 없이), 도착하면 다시 잡힌다
  const focus = t < STOP_T[i].a && i > 0
    ? 1 - ease.sine(seg(t, STOP_T[i - 1].d, STOP_T[i - 1].d + 0.2))
    : ease.p4out(seg(t, STOP_T[i].a - 0.04, STOP_T[i].a + 0.38))
  // 초점 링 회전: 지나온 거리 + 초점 조작
  let path = 0
  for (let j = 1; j <= i; j++) {
    const k = j < i || t >= STOP_T[j].a ? 1 : ease.inOut3(seg(t, STOP_T[j - 1].d, STOP_T[j].a))
    path += Math.hypot(S[j].x - S[j - 1].x, S[j].y - S[j - 1].y) * k
  }
  // 초점 링: 이동 거리만큼 돌고, 초점을 풀고 잡을 때 앞뒤로 비튼다(연속)
  const rot = path * 0.0035 + focus * 0.22
  return { x, y, i, focus, mv, rot, S }
}

/** 렌즈 속: 확대된 앰버 점구름 (src 원 얼굴 좌표의 확대 중심, cx,cy 렌즈 중심) */
function cloudFx(fHi: Face, src: P2, cx: number, cy: number, blur: number, alpha: number) {
  if (alpha <= 0) return
  const L = tmp()
  const x = L.x
  const R = LR / MAG + 6
  for (const p of fHi.pts) {
    const dx = p.x - src.x, dy = p.y - src.y
    if (dx * dx + dy * dy > R * R) continue
    const px = cx + dx * MAG, py = cy + dy * MAG
    const a = Math.min(1, 0.16 + p.s * 0.5 + p.edge * 0.42)
    x.fillStyle = p.edge ? `rgba(255,220,160,${a})` : `rgba(232,166,75,${a * 0.85})`
    const s = p.edge ? 1.5 + p.r * 0.7 : 0.9 + p.r * 0.8
    x.beginPath(); x.arc(px, py, s, 0, 6.283); x.fill()
  }
  const bx = cx - LR - 10, by = cy - LR - 10, bw = (LR + 10) * 2
  blurRegion(L.c, bx, by, bw, bw, blur, alpha)
  blurRegion(L.c, bx, by, bw, bw, 3 + blur, 0.75 * alpha, 'lighter')
  blurRegion(L.c, bx, by, bw, bw, 16 + blur * 1.4, 0.5 * alpha, 'lighter')
}

/** 판독 계측선(렌즈 속, 확대 좌표). k 그리기 진행, a 알파 */
function overlayFx(f: Face, j: number, src: P2, cx: number, cy: number, k: number, a: number, f2: ReturnType<typeof stops>) {
  if (k <= 0 || a <= 0) return
  const m = (i: number) => ({ x: cx + (f.lm[i].x - src.x) * MAG, y: cy + (f.lm[i].y - src.y) * MAG })
  const L = tmp()
  const x = L.x
  const cel = 'rgba(156,195,178,1)'
  const amb = 'rgba(255,208,138,1)'
  const ln = (x0: number, y0: number, x1: number, y1: number, kk: number, col = cel, w = 1.3) => {
    if (kk <= 0) return
    x.strokeStyle = col; x.lineWidth = w
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(lerp(x0, x1, kk), lerp(y0, y1, kk)); x.stroke()
  }
  /** 렌즈 속 한자 꼬리표: 점구름 위에서도 읽히도록 먹빛 후광을 두른다 */
  const tag = (s: string, px: number, py: number, kk: number, col = cel, size = 25, align: CanvasTextAlign = 'center') => {
    if (kk <= 0) return
    x.save(); x.globalAlpha = kk; x.font = `400 ${size}px ${FONT.serif}`; x.textAlign = align; x.textBaseline = 'middle'
    x.letterSpacing = '3px'
    x.shadowColor = 'rgba(4,4,4,1)'; x.shadowBlur = 12; x.fillStyle = 'rgba(4,4,4,0.9)'
    x.fillText(s, px, py); x.fillText(s, px, py)
    x.shadowBlur = 0; x.fillStyle = col
    x.fillText(s, px, py); x.restore()
  }
  const chord = (yy: number) => Math.sqrt(Math.max(0, LR * LR - (yy - cy) ** 2)) - 8
  const k1 = ease.out3(clamp(k * 1.6)), k2 = ease.out3(clamp(k * 1.6 - 0.4)), k3 = ease.sine(clamp(k * 2 - 1))
  if (j === 0) {
    // 天(髮際)·人(眉間) 수평선과 上停 치수
    const y1 = m(10).y, y2 = m(9).y
    ln(cx - chord(y1), y1, cx + chord(y1), y1, k1)
    ln(cx + chord(y2), y2, cx - chord(y2), y2, k2)
    const dx = cx + 96
    ln(dx, y1 + 4, dx, y2 - 4, k2, amb, 1.4)
    for (const yy of [y1, y2]) ln(dx - 9, yy, dx + 9, yy, k2, amb, 1.4)
    tag('天', cx - chord(y1) + 30, y1 - 20, k3)
    tag('人', cx - chord(y2) + 30, y2 + 22, k3)
    tag('上停', dx - 14, (y1 + y2) / 2, k3, amb, 24, 'right')
  } else if (j === 1) {
    // 눈꼬리 각: 안쪽→바깥 눈꼬리 선, 수평 기준선, 각도 호
    const ii = m(362), oo = m(263)
    const ang = Math.atan2(oo.y - ii.y, oo.x - ii.x)
    const ext = 70
    ln(ii.x - Math.cos(ang) * 30, ii.y - Math.sin(ang) * 30, oo.x + Math.cos(ang) * ext, oo.y + Math.sin(ang) * ext, k1, amb, 1.5)
    x.save(); x.setLineDash([5, 6]); ln(ii.x + 24, ii.y, ii.x - (ii.x - oo.x) - ext - 10, ii.y, k2); x.restore()
    if (k2 > 0) {
      // 수평(π)에서 눈꼬리 선까지의 각
      const aEnd = ang < 0 ? ang + 2 * Math.PI : ang
      x.strokeStyle = amb; x.lineWidth = 1.6
      x.beginPath(); x.arc(ii.x, ii.y, 128, Math.PI, Math.PI + (aEnd - Math.PI) * k2, aEnd < Math.PI); x.stroke()
      for (const aa of [Math.PI, aEnd]) ln(ii.x + Math.cos(aa) * 120, ii.y + Math.sin(aa) * 120, ii.x + Math.cos(aa) * 136, ii.y + Math.sin(aa) * 136, k2, amb, 1.4)
    }
    for (const p of [ii, oo]) { x.strokeStyle = amb; x.lineWidth = 1.2; x.globalAlpha = k1; x.beginPath(); x.arc(p.x, p.y, 7, 0, 6.283); x.stroke(); x.globalAlpha = 1 }
    tag('目尾', oo.x - 10, oo.y - 52, k3)
    void f2
  } else if (j === 2) {
    // 鼻廣: 콧방울 양끝 세로 눈금 + 치수선
    const a1 = m(129), a2 = m(358)
    const yb = Math.max(a1.y, a2.y) + 64
    for (const p of [a1, a2]) { ln(p.x, p.y - 44, p.x, yb + 10, k1); x.strokeStyle = amb; x.globalAlpha = k1; x.lineWidth = 1.2; x.beginPath(); x.arc(p.x, p.y, 6, 0, 6.283); x.stroke(); x.globalAlpha = 1 }
    const mx = (a1.x + a2.x) / 2
    ln(mx, yb, a1.x + 3, yb, k2, amb, 1.4); ln(mx, yb, a2.x - 3, yb, k2, amb, 1.4)
    for (const p of [a1, a2]) {
      const s = Math.sign(p.x - mx)
      ln(p.x - s * 2, yb, p.x - s * 12, yb - 6, k3, amb, 1.4); ln(p.x - s * 2, yb, p.x - s * 12, yb + 6, k3, amb, 1.4)
    }
    tag('鼻廣', mx, yb + 32, k3, amb, 25)
  } else if (j === 3) {
    // 唇厚: 윗입술~아랫입술 두께
    const up = m(0), lo = m(17)
    const dx = cx + 132
    ln(up.x + 40, up.y, dx + 18, up.y, k1); ln(lo.x + 40, lo.y, dx + 18, lo.y, k1)
    ln(dx, up.y + 3, dx, lo.y - 3, k2, amb, 1.4)
    for (const [yy, s] of [[up.y, 1], [lo.y, -1]] as const) { ln(dx, yy + s * 2, dx - 6, yy + s * 12, k3, amb, 1.4); ln(dx, yy + s * 2, dx + 6, yy + s * 12, k3, amb, 1.4) }
    // 입술 선
    const seam = [61, 78, 81, 13, 311, 308, 291].map(m)
    if (k1 > 0) { x.save(); x.setLineDash([3, 5]); x.strokeStyle = cel; x.globalAlpha = 0.7 * k1; x.lineWidth = 1; x.beginPath(); seam.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.stroke(); x.restore() }
    tag('唇', dx + 18, (up.y + lo.y) / 2, k3, cel, 25, 'left')
  } else {
    // 頤: 턱선 윤곽에 빛이 선을 긋고, 하악각에서 반대편 턱으로 너비 선
    const ids = [58, 172, 136, 150, 149, 176, 148, 152]
    const pts = ids.map(m)
    const lens: number[] = []
    let tot = 0
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); lens.push(d); tot += d }
    let left = tot * k1
    x.strokeStyle = amb; x.lineWidth = 2.2
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length && left > 0; i++) {
      const u = Math.min(1, left / lens[i - 1])
      x.lineTo(lerp(pts[i - 1].x, pts[i].x, u), lerp(pts[i - 1].y, pts[i].y, u))
      left -= lens[i - 1]
    }
    x.stroke()
    const ja = m(172), jb = m(397)
    x.save(); x.setLineDash([6, 6]); ln(ja.x, ja.y, jb.x, jb.y, k2, cel, 1.3); x.restore()
    x.strokeStyle = amb; x.lineWidth = 1.3; x.globalAlpha = k2
    x.beginPath(); x.arc(ja.x, ja.y, 9, 0, 6.283); x.stroke(); x.globalAlpha = 1
    // 하악각: 턱선의 두 방향 사이 호
    const pa = m(58), pb = m(136)
    const a0 = Math.atan2(pa.y - ja.y, pa.x - ja.x), a1 = Math.atan2(pb.y - ja.y, pb.x - ja.x)
    if (k3 > 0) { x.strokeStyle = cel; x.lineWidth = 1.2; x.beginPath(); x.arc(ja.x, ja.y, 46, a0, lerp(a0, a1, k3), a1 < a0); x.stroke() }
    tag('下顎角', ja.x - 22, ja.y + 70, k3, cel, 25, 'right')
  }
  clipLens(cx, cy, LR - 2, () => {
    blurRegion(L.c, cx - LR, cy - LR, LR * 2, LR * 2, 0, a)
    blurRegion(L.c, cx - LR, cy - LR, LR * 2, LR * 2, 5, 0.55 * a, 'lighter')
  })
}
function clipLens(cx: number, cy: number, r: number, fn: () => void) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, r), 0, 6.283); ctx.clip(); fn(); ctx.restore()
}

interface LensO {
  x: number; y: number; src: P2
  ap: number // 조리개(유리) 열림 0→1
  ring: number // 경통 외곽선 그리기 0→1
  barrel: number // 경통 불투명도
  blur: number // 렌즈 속 랙 포커스(px)
  rot: number // 초점 링 회전
  cloud: number
  inner?: () => void
  top?: { s: string; a: number }[]
  bot?: { s: string; a: number; k: number }[]
}
/** 확대경 한 벌: 종이 위 그늘 → 경통 → 유리 속(암시야 + 점구름 + 계측선) → 반사 → 경통 각인 */
function lensFx(fHi: Face, o: LensO) {
  const { x: cx, y: cy } = o
  // 종이 위 그늘(경통이 등불을 가린다)
  if (o.barrel > 0) {
    ctx.save()
    const g = ctx.createRadialGradient(cx, cy, RO - 6, cx, cy, RO + 64)
    g.addColorStop(0, `rgba(24,18,10,${0.4 * o.barrel})`); g.addColorStop(1, 'rgba(24,18,10,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, RO + 64, 0, 6.283); ctx.fill()
    ctx.restore()
  }
  // 경통
  if (o.barrel > 0) {
    ctx.save()
    ctx.globalAlpha = o.barrel
    const g = ctx.createRadialGradient(cx, cy - 30, LR, cx, cy, RO)
    g.addColorStop(0, '#121210'); g.addColorStop(0.5, '#0a0a0a'); g.addColorStop(1, '#060606')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, RO, 0, 6.283); ctx.arc(cx, cy, LR * o.ap, 0, 6.283, true); ctx.fill()
    // 초점 눈금(안쪽 테)
    for (let i = 0; i < 120; i++) {
      const a = o.rot + (i / 120) * Math.PI * 2
      const maj = i % 10 === 0
      const r0 = LR + 3, r1 = LR + (maj ? 11 : 7)
      ctx.strokeStyle = maj ? 'rgba(156,195,178,0.55)' : 'rgba(156,195,178,0.26)'
      ctx.lineWidth = maj ? 1.3 : 1
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke()
    }
    // 천장 빛을 받은 경통 윗테
    ctx.strokeStyle = 'rgba(255,208,138,0.5)'; ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(255,200,120,0.9)'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(cx, cy, RO - 1.5, -Math.PI * 0.86, -Math.PI * 0.14); ctx.stroke()
    ctx.restore()
  }
  // 유리 속
  const ar = LR * o.ap
  if (ar > 1) {
    clipLens(cx, cy, ar, () => {
      const g = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy, LR)
      g.addColorStop(0, '#16110b'); g.addColorStop(0.7, '#0b0907'); g.addColorStop(1, '#050505')
      ctx.fillStyle = g
      ctx.fillRect(cx - LR, cy - LR, LR * 2, LR * 2)
      // 확대된 한지 섬유가 빛을 희미하게 통과시킨다
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.07
      const sr = LR / MAG
      ctx.drawImage(paperCache(), o.src.x - sr, o.src.y - sr, sr * 2, sr * 2, cx - LR, cy - LR, LR * 2, LR * 2)
      ctx.restore()
      cloudFx(fHi, o.src, cx, cy, o.blur, o.cloud)
      o.inner?.()
      // 유리 가장자리 어둠과 반사
      const vg = ctx.createRadialGradient(cx, cy, LR * 0.62, cx, cy, LR)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = vg; ctx.fillRect(cx - LR, cy - LR, LR * 2, LR * 2)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.strokeStyle = 'rgba(255,244,220,0.22)'; ctx.lineWidth = 3
      ctx.filter = 'blur(1.5px)'
      ctx.beginPath(); ctx.arc(cx, cy, LR - 14, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke()
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,244,220,0.14)'
      ctx.beginPath(); ctx.arc(cx, cy, LR - 26, Math.PI * 1.12, Math.PI * 1.3); ctx.stroke()
      ctx.restore()
      // 중심 십자
      const c = 'rgba(156,195,178,0.4)'
      hair(cx - 12, cy, cx - 4, cy, c); hair(cx + 4, cy, cx + 12, cy, c); hair(cx, cy - 12, cx, cy - 4, c); hair(cx, cy + 4, cx, cy + 12, c)
    })
  }
  // 경통 테두리(빛이 원을 긋는다)
  if (o.ring > 0) {
    const L = tmp()
    L.x.strokeStyle = C.gold; L.x.lineWidth = 1.4
    L.x.beginPath(); L.x.arc(cx, cy, RO, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o.ring); L.x.stroke()
    L.x.strokeStyle = 'rgba(210,185,138,0.75)'; L.x.lineWidth = 1
    L.x.beginPath(); L.x.arc(cx, cy, LR * Math.max(o.ap, 0.02), Math.PI / 2, Math.PI / 2 + Math.PI * 2 * o.ring); L.x.stroke()
    const b = RO + 12
    blurRegion(L.c, cx - b, cy - b, b * 2, b * 2, 0, 0.85)
    blurRegion(L.c, cx - b, cy - b, b * 2, b * 2, 5, 0.6, 'lighter')
  }
  // 경통 각인: 위쪽 호(부위), 아래쪽 호(수치)
  const tr = LR + BAR / 2 + 4
  for (const s of o.top ?? []) arcText(s.s, cx, cy, tr, true, `300 15px ${FONT.mono}`, C.gold, 0.85 * s.a * o.barrel)
  for (const s of o.bot ?? []) arcText(s.s, cx, cy, tr - 2, false, `400 17px ${FONT.mono}`, C.amber, s.a * o.barrel, s.k, '#FFF4DC')
}

/* ───────── S12 무대(뒤 장면들이 같은 그림에서 출발하도록 함수로 둔다) ───────── */
interface S12O {
  T?: number
  close?: number // 렌즈 닫힘(S13)
  ui?: number // 자·판독값·표식 사라짐(S13)
  glow?: number // 창 밝기 덮어쓰기
  faceA?: number
  beamK?: number
  hud?: boolean
}
/** 판독 공간 → 화면: 족자 축척에서 1배로 밀고 들어간다(화면 위쪽 끝을 축으로 확대) */
function camera12(t: number) {
  const m = ease.inOut3(seg(t, 0, 0.95))
  const k = Math.exp(Math.log(PS) * (1 - m))
  return { m, k, ay: -15 + (FC.y + 15) * k }
}
function stage12(t: number, o: S12O = {}) {
  const T = o.T ?? T0.S12 + t
  const f = face(FC.x, FC.y, FC.w)
  const fHi = face(FC.x, FC.y, FC.w, 14, 7)
  const st = stops(f)
  const cam = camera12(t)
  const close = o.close ?? 0
  const ui = 1 - (o.ui ?? 0)

  // ── S11 마지막 프레임: 카메라가 족자 속으로 밀고 들어가며 초점이 풀리고 사라진다
  const s11a = 1 - ease.sine(seg(t, 0.12, 0.72))
  if (s11a > 0) {
    ctx.save()
    ctx.translate(FC.x, cam.ay); ctx.scale(cam.k / PS, cam.k / PS); ctx.translate(-FC.x, -SCR.faceY)
    drawBlur(s11Cache(), 7 * ease.sine(seg(t, 0.04, 0.6)), s11a)
    ctx.restore()
  }

  // ── 판독 공간(창): 족자 화심이 늘어나 창이 된다
  const paperA = ease.sine(seg(t, 0.06, 0.55))
  const glow = o.glow ?? lerp(0.64, 0.92, ease.sine(seg(t, 0.25, 1.2)))
  const morph = ease.inOut3(seg(t, 0.05, 1.0))
  const rect = {
    x: lerp(SCROLL_RECT.x, WIN.x, morph), y: lerp(SCROLL_RECT.y, WIN.y, morph),
    w: lerp(SCROLL_RECT.w, WIN.w, morph), h: lerp(SCROLL_RECT.h, WIN.h, morph),
  }
  const world = (fn: () => void) => {
    ctx.save()
    ctx.translate(FC.x, cam.ay); ctx.scale(cam.k, cam.k); ctx.translate(-FC.x, -FC.y)
    fn()
    ctx.restore()
  }
  const lens = lensAt(f, t)
  world(() => {
    windowFx(glow * paperA, (o.faceA ?? 1) * paperA, rect, ease.sine(seg(t, 0.4, 1.0)))
    // 지나간 판독 지점에 남는 청자 표식
    for (let j = 0; j < 4; j++) {
      const a = ease.sine(seg(t, STOP_T[j].d, STOP_T[j].d + 0.35)) * ui
      if (a <= 0) continue
      const p = lens.S[j]
      const c = C.celadonDeep
      hair(p.x - 9, p.y, p.x - 3, p.y, c, 1.3, 0.85 * a); hair(p.x + 3, p.y, p.x + 9, p.y, c, 1.3, 0.85 * a)
      hair(p.x, p.y - 9, p.x, p.y - 3, c, 1.3, 0.85 * a); hair(p.x, p.y + 3, p.x, p.y + 9, c, 1.3, 0.85 * a)
      text(st[j].mark, p.x + 14, p.y - 10, `400 17px ${FONT.serif}`, c, { alpha: 0.8 * a })
    }
  })
  beamFx((o.beamK ?? 0.55) * ease.sine(seg(t, 0.15, 0.9)))

  // ── 확대경
  if (t >= LENS_IN) {
    const form = seg(t, LENS_IN, LENS_IN + 0.34)
    const j = lens.i
    const arrived = t >= STOP_T[j].a
    const blur = 7 * (1 - lens.focus) + 2 * lens.mv + 8 * ease.sine(seg(close, 0, 0.4))
    // 닫힘: 조리개가 닫히는 동안(0→0.42) 경통 전체가 한 점으로 줄어들기 시작한다(0.22→0.7)
    const ap = ease.out3(seg(t, LENS_IN + 0.06, LENS_IN + 0.36)) * (1 - ease.inOut3(seg(close, 0, 0.42)))
    const shrink = 1 - ease.inOut3(seg(close, 0.22, 0.7))
    const ring = ease.out3(form)
    // 맺힘: 경통은 곧바로 불투명해지고, 렌즈가 종이 위로 내려앉듯 0.86→1배
    const barrel = ease.sine(seg(t, LENS_IN + 0.02, LENS_IN + 0.12))
    const settle = lerp(0.86, 1, ease.out3(seg(t, LENS_IN, LENS_IN + 0.4)))
    const ovK = arrived ? seg(t, STOP_T[j].a + 0.08, STOP_T[j].a + 0.5) : 0
    const ovA = (1 - ease.sine(seg(t, STOP_T[j].d - 0.14, STOP_T[j].d))) * (1 - clamp(close * 2.2))
    const top: { s: string; a: number }[] = []
    const bot: { s: string; a: number; k: number }[] = []
    for (let q = 0; q < 5; q++) {
      const ai = ease.sine(seg(t, STOP_T[q].a - 0.05, STOP_T[q].a + 0.25)) * (1 - ease.sine(seg(t, STOP_T[q].d - 0.12, STOP_T[q].d + 0.05))) * (1 - ease.sine(seg(close, 0, 0.3)))
      if (ai <= 0) continue
      top.push({ s: st[q].ring, a: ai })
      bot.push({ s: `${st[q].val}${st[q].sig ? '  ' + st[q].sig : ''}`, a: ai, k: seg(t, STOP_T[q].a + 0.15, STOP_T[q].a + 0.55) })
    }
    if (shrink > 0.01) world(() => {
      ctx.translate(lens.x, lens.y); ctx.scale(shrink * settle, shrink * settle); ctx.translate(-lens.x, -lens.y)
      lensFx(fHi, {
        x: lens.x, y: lens.y, src: { x: lens.x, y: lens.y }, ap, ring, barrel, blur, rot: lens.rot + 0.9 * ease.inOut3(seg(close, 0, 0.7)),
        cloud: ease.sine(seg(t, LENS_IN + 0.12, LENS_IN + 0.45)) * (1 - ease.sine(seg(close, 0.05, 0.45))),
        inner: () => overlayFx(f, j, { x: lens.x, y: lens.y }, lens.x, lens.y, ovK, ovA, st),
        top, bot,
      })
    })
    // 닫힌 자리에 남는 작은 불씨
    const sp = ease.sine(seg(close, 0.55, 0.72)) * (1 - ease.sine(seg(close, 0.78, 1)))
    if (sp > 0) world(() => sparkFx(lens.x, lens.y, sp))
  }
  dustFx(T, 0.8 * ease.sine(seg(t, 0.2, 0.9)) * (o.beamK != null ? o.beamK / 0.55 : 1))
  vignette(0.6 * clamp(1 - s11a * 1.05))

  // ── 화면 고정 요소: 위치 자, 판독값
  const uiA = ease.sine(seg(t, 0.95, 1.4)) * ui
  if (uiA > 0) ruler12(t, lens, st, uiA)
  for (let q = 0; q < 5; q++) {
    const kin = seg(t, STOP_T[q].a + 0.02, STOP_T[q].a + 0.36)
    // 다음 판독값이 새겨질 때까지 남아 있다가 그 자리를 내준다
    const nx = q < 4 ? STOP_T[q + 1].a : 99
    const kout = seg(t, nx - 0.14, nx + 0.06)
    const a = ease.sine(kin) * (1 - ease.sine(kout)) * ui
    if (a > 0) readout(st[q], kin, a, (1 - ease.out3(kin)) * 8 + kout * 10 + (o.ui ?? 0) * 8, kout * 30 + (o.ui ?? 0) * 26)
  }
  if (o.hud !== false) {
    header(HEAD_L, '')
    text('問診 · SURVEY', W - 72, 96, `300 20px ${FONT.mono}`, C.ash, { align: 'right', spacing: 2, alpha: 1 - ease.sine(seg(t, 0.1, 0.34)) })
    stageTag(1, '형상 판독', ease.sine(seg(t, 0.4, 0.75)))
    disclaimer(1 - ease.sine(seg(t, 0.1, 0.6)))
  }
}
/** 작은 불씨(렌즈가 닫힌 자리) */
function sparkFx(x: number, y: number, a: number) {
  const L = tmp()
  const g = L.x.createRadialGradient(x, y, 0, x, y, 22)
  g.addColorStop(0, 'rgba(255,244,220,1)'); g.addColorStop(0.3, 'rgba(255,208,138,0.6)'); g.addColorStop(1, 'rgba(232,166,75,0)')
  L.x.fillStyle = g; L.x.beginPath(); L.x.arc(x, y, 22, 0, 6.283); L.x.fill()
  blurRegion(L.c, x - 40, y - 40, 80, 80, 0, a, 'lighter')
  blurRegion(L.c, x - 40, y - 40, 80, 80, 10, a, 'lighter')
}
/** 왼쪽 여백: 렌즈 높이를 재는 청자 자, 판독 부위 한자, 앰버 표식, 렌즈로 이어지는 빛의 선 */
function ruler12(t: number, lens: ReturnType<typeof lensAt>, st: ReturnType<typeof stops>, a: number) {
  const k = ease.out3(seg(t, 0.95, 1.6))
  const y1 = lerp(RUL.y0, RUL.y1, k)
  hair(RUL.x, RUL.y0, RUL.x, y1, C.celadon, 1, 0.34 * a)
  for (let y = RUL.y0; y <= y1; y += 17) hair(RUL.x, y, RUL.x + ((y - RUL.y0) % 85 === 0 ? 12 : 6), y, C.celadon, 1, 0.24 * a)
  lens.S.forEach((p, j) => {
    if (p.y > y1) return
    const cur = j === lens.i
    const done = t >= STOP_T[j].d
    const col = cur ? C.amberCore : done ? C.hanji : C.ash
    const al = (cur ? 1 : done ? 0.62 : 0.4) * a
    hair(RUL.x - 4, p.y, RUL.x + 18, p.y, col, cur ? 1.6 : 1.2, al)
    text(st[j].mark, RUL.x - 32, p.y + 10, `400 28px ${FONT.serif}`, col, { align: 'center', alpha: al })
  })
  // 렌즈 높이 표식
  const my = lens.y
  const L = tmp()
  L.x.strokeStyle = C.amberCore; L.x.lineWidth = 2
  L.x.beginPath(); L.x.moveTo(RUL.x - 2, my); L.x.lineTo(RUL.x + 30, my); L.x.stroke()
  L.x.fillStyle = C.amberCore
  L.x.beginPath(); L.x.moveTo(RUL.x + 30, my - 5); L.x.lineTo(RUL.x + 38, my); L.x.lineTo(RUL.x + 30, my + 5); L.x.closePath(); L.x.fill()
  blurRegion(L.c, RUL.x - 10, my - 12, 60, 24, 0, a)
  blurRegion(L.c, RUL.x - 10, my - 12, 60, 24, 6, 0.8 * a, 'lighter')
  // 표식 → 경통으로 이어지는 선(한지 위에서는 짙은 청자)
  const ex = lens.x - RO - 8
  if (ex > RUL.x + 46) {
    hair(RUL.x + 44, my, WIN.x, my, C.celadon, 1, 0.42 * a)
    hair(WIN.x, my, ex, my, C.celadonDeep, 1, 0.55 * a)
  }
}
/** 아래 판독값: 한자 표제, 큰 이탤릭 수치 + 편차, 한글 설명, 랜드마크 번호 */
function readout(s: ReturnType<typeof stops>[number], k: number, a: number, blur: number, rise: number) {
  const y = (v: number) => v - rise
  text(s.hz, W / 2, y(RD.label), `200 52px ${FONT.serif}`, C.hanji, { align: 'center', spacing: 20, alpha: 0.88 * a, blur })
  // 수치 + 편차를 한 덩어리로 가운데 정렬
  let vs = 132
  const sigF = `300 34px ${FONT.mono}`
  const sigW = s.sig ? measure(s.sig, sigF, 3) + 28 : 0
  let vf = `italic 300 ${vs}px ${FONT.italic}`
  let vw = measure(s.val, vf, 2)
  if (vw + sigW > 860) { vs = Math.floor((vs * (860 - sigW)) / vw); vf = `italic 300 ${vs}px ${FONT.italic}`; vw = measure(s.val, vf, 2) }
  const x0 = W / 2 - (vw + sigW) / 2
  text(s.val, x0, y(RD.value), vf, C.hanji, { spacing: 2, alpha: a, blur })
  if (s.sig) engrave(s.sig, x0 + vw + 28, y(RD.value) - 6, sigF, C.amber, clamp((k - 0.25) / 0.75), { spacing: 3, alpha: a, blur, hot: '#FFF4DC' })
  text(s.ko, W / 2, y(RD.cap), `400 30px ${FONT.sans}`, C.hanjiShadow, { align: 'center', spacing: 1, alpha: 0.95 * a, blur })
  text(s.lm, W / 2, y(RD.lm), `300 19px ${FONT.mono}`, C.ash, { align: 'center', spacing: 4, alpha: 0.9 * a, blur })
}

/* ───────── S12 ───────── */
const S12: Scene = {
  id: 'S12',
  act: '판독',
  title: '확대경 판독',
  note: '카메라가 족자 속 먹 초상으로 밀고 들어가 족자의 화심이 그대로 한지 창이 된다. 확대경이 이마→눈→코→입술→턱을 차례로 짚을 때마다 렌즈 속에서만 앰버 점구름이 2배로 맺히며 초점이 잡히고, 경통과 화면 아래에 수치가 새겨진다.',
  dur: S12_DUR,
  render(t) { stage12(t) },
}

/* ───────── S13: 글자 기둥 ───────── */
type Kind = 'face' | 'q' | 'organ' | 'type' | 'rel'
const STY: Record<Kind, { size: number; cjk: number; color: string; a: number }> = {
  face: { size: 23, cjk: 28, color: C.amber, a: 0.8 },
  q: { size: 23, cjk: 28, color: C.celadon, a: 0.62 },
  organ: { size: 23, cjk: 38, color: C.hanji, a: 0.5 },
  type: { size: 23, cjk: 36, color: C.hanji, a: 0.78 },
  rel: { size: 23, cjk: 32, color: C.hanjiDeep, a: 0.55 },
}
const isCJK = (ch: string) => /[㐀-鿿가-힯]/.test(ch)
/** 세로쓰기 진행 폭: 한자는 바로 서고, 로마자·숫자는 옆으로 눕혀(세로 조판) 글자 폭만큼 나아간다 */
function adv(ch: string, k: Kind) {
  const s = STY[k]
  if (isCJK(ch)) return s.cjk * 1.14
  return s.size * 0.6 + 2.2
}
const tokLen = (s: string, k: Kind) => [...s].reduce((a, ch) => a + adv(ch, k), 0)
const TYPE_OF: Record<string, keyof typeof TYPE_COL> = { 太陰: 'taeeum', 少陽: 'soyang', 少陰: 'soeum', 太陽: 'taeyang' }
const typeText = (s: string) => mixHex(TYPE_COL[TYPE_OF[s] ?? 'taeyang'], '#FFFFFF', 0.28)

/** 창살 아홉 칸 */
const colX = (c: number) => WIN.x + ((c + 0.5) * WIN.w) / 9
const COLDEF: { kind: Kind; v: number; cycle: string[] }[] = [
  { kind: 'face', v: 104, cycle: ['頤 0.80', '三停', 'EYE +1.7°', '唇厚 0.10', 'FACE·W', '鼻廣 0.35', '目 0.22'] },
  { kind: 'q', v: 84, cycle: ['Q01·B', 'Q05·C', 'Q09·A', 'Q14·D', 'Q02·A', 'Q16·B', 'Q11·C'] },
  { kind: 'organ', v: 64, cycle: ['肺', '脾', '肝', '腎'] },
  { kind: 'type', v: 78, cycle: ['少陰', '太陰', '太陽', '少陽'] },
  { kind: 'rel', v: 52, cycle: ['腎小', '肺大', '肝小', '脾小', '腎大'] },
  { kind: 'type', v: 74, cycle: ['少陽', '太陽', '少陰', '太陰'] },
  { kind: 'organ', v: 60, cycle: ['腎', '肝', '脾', '肺'] },
  { kind: 'q', v: 90, cycle: ['Q13·B', 'Q04·D', 'Q18·A', 'Q06·B', 'Q10·C', 'Q15·A', 'Q08·A'] },
  { kind: 'face', v: 112, cycle: ['FACE·NOSE', 'BMI 20.4', '三停 0.27', '目尾', '唇 0.10', 'H 173'] },
]
/** 대조 사건: 얼굴 근거 × 문진 응답 → 장부 → 체질. 같은 순간 빛이 글자들을 잇는다 */
const EVENTS = [
  { t: 1.25, strong: true, toks: [{ c: 0, s: 'FACE·JAW', y: 640 }, { c: 1, s: 'Q12·A', y: 700 }, { c: 2, s: '肝', y: 676 }, { c: 3, s: '太陰', y: 712 }, { c: 4, s: '肝大', y: 690 }] },
  { t: 1.95, strong: true, toks: [{ c: 4, s: '肺小', y: 930 }, { c: 5, s: '太陰', y: 952 }, { c: 6, s: '肺', y: 922 }, { c: 7, s: 'Q07·A', y: 960 }, { c: 8, s: '鼻廣 0.35', y: 900 }] },
  { t: 2.65, strong: false, toks: [{ c: 0, s: 'BMI 20.4', y: 1120 }, { c: 1, s: 'Q03·B', y: 1150 }, { c: 2, s: '脾', y: 1132 }, { c: 3, s: '少陽', y: 1160 }, { c: 4, s: '脾大', y: 1140 }] },
]
const LOG: { n: string; face: string; q: string; rel: string; type: string; note?: string }[] = [
  { n: '01', face: 'FACE·JAW 0.80', q: 'Q12·A', rel: '肝大', type: '太陰' },
  { n: '02', face: '鼻廣 0.35', q: 'Q07·A 汗', rel: '肺小', type: '太陰' },
  { n: '03', face: 'BMI 20.4', q: 'Q03·B', rel: '脾大', type: '少陽', note: '약한 근거' },
]
const LOG_Y = [1566, 1646, 1726]
/** 대조 기록의 칸(창 폭에 맞춘 표) */
const LX = { n: WIN.x, face: WIN.x + 58, x: WIN.x + 284, q: WIN.x + 316, rel: WIN.x + 462, arr: WIN.x + 548, type: WIN.x + 592, end: WIN.x + WIN.w }

interface Tok { s: string; base: number; len: number; ev: number }
interface Col { x: number; v: number; kind: Kind; toks: Tok[] }
let COLS: Col[] | null = null
function cols(): Col[] {
  if (COLS) return COLS
  const GAP = 40
  COLS = COLDEF.map((d, c) => {
    const evs: Tok[] = []
    EVENTS.forEach((e, ei) => e.toks.forEach((tk) => {
      if (tk.c !== c) return
      const len = tokLen(tk.s, d.kind)
      evs.push({ s: tk.s, len, base: tk.y - len / 2 + d.v * e.t, ev: ei })
    }))
    const toks: Tok[] = []
    let cur = 96 + ((c * 53) % 70)
    let idx = c * 3
    const end = WIN.y + WIN.h + d.v * 6 + 160
    while (cur < end) {
      const s = d.cycle[idx % d.cycle.length]
      const len = tokLen(s, d.kind)
      const hit = evs.find((e) => cur < e.base + e.len + GAP && cur + len + GAP > e.base)
      if (hit) { cur = hit.base + hit.len + GAP; continue }
      toks.push({ s, base: cur, len, ev: -1 })
      // 글자 사이 숨: 칸마다 다른 간격(빽빽한 '코드 비'가 되지 않게)
      cur += len + GAP + ((idx * 53 + c * 29) % 5) * 26
      idx++
    }
    return { x: colX(c), v: d.v, kind: d.kind, toks: [...toks, ...evs] }
  })
  return COLS
}
/** 대조 사건의 플레어 정도 */
function flareOf(ei: number, t: number) {
  if (ei < 0) return 0
  const e = EVENTS[ei]
  return ease.out3(seg(t, e.t - 0.12, e.t + 0.16)) * (1 - ease.sine(seg(t, e.t + 0.55, e.t + 1.2)))
}
interface ColO {
  /** S14 응집: 0→1 */
  gather?: (c: number, y: number) => { gx: number; gy: number; streak: number; melt: number }
  alpha?: number
}
/** 대조 사건이 일어나는 동안 나머지 글자는 물러난다(초점이 사건으로 옮겨 간다) */
function eventFocus(tc: number) {
  let m = 0
  EVENTS.forEach((_, i) => { m = Math.max(m, flareOf(i, tc) * (EVENTS[i].strong ? 1 : 0.8)) })
  return m
}
/** 글자 기둥 그리기. tc: S13 시각(흐름 위치), ta: 등장 시각 */
function columnsFx(tc: number, ta: number, o: ColO = {}) {
  const A = o.alpha ?? 1
  if (A <= 0) return
  const N = tmp() // 가까운 기둥(초점 안)
  const Fa = tmp() // 바깥 기둥(초점 밖, 얕은 심도)
  const F = tmp() // 플레어 글자
  const S = o.gather ? tmp() : null // 응집 빛줄기
  const cs = cols()
  const top = WIN.y, bot = WIN.y + WIN.h
  const fdim = 1 - 0.55 * eventFocus(tc)
  cs.forEach((col, c) => {
    const d = Math.abs(c - 4)
    const ac = seg(ta, 0.5 + d * 0.07, 1.1 + d * 0.07)
    if (ac <= 0) return
    const front = lerp(bot + 60, top - 140, ease.out3(ac)) // 아래에서 위로 맺혀 오른다
    const st = STY[col.kind]
    const far = d >= 3
    for (const tk of col.toks) {
      const y0 = tk.base - col.v * tc
      if (y0 > bot + 40 || y0 + tk.len < top - 40) continue
      const fl = flareOf(tk.ev, tc)
      const isType = col.kind === 'type'
      const tau = isType && TYPE_OF[tk.s] === 'taeyang'
      const color = isType ? (tau ? C.ash : typeText(tk.s)) : st.color
      const base = st.a * (tau ? 0.32 : 1) * (far ? 0.62 : 1)
      let yy = y0
      for (const ch of [...tk.s]) {
        const a1 = adv(ch, col.kind)
        const cy = yy + a1 / 2
        yy += a1
        if (ch === ' ') continue
        let mask = clamp((cy - top - 6) / 170) * clamp((bot - 6 - cy) / 150) * clamp((cy - front) / 140)
        if (mask <= 0) continue
        let x = col.x, y = cy, streak = 0, melt = 0
        if (o.gather) {
          const g = o.gather(c, cy)
          x = lerp(col.x, 540, g.gx); y = lerp(cy, 760, g.gy); streak = g.streak; melt = g.melt
          mask = Math.max(mask, streak > 0 ? clamp((cy - top + 120) / 200) * clamp((bot + 120 - cy) / 200) : 0)
        }
        const cjk = isCJK(ch)
        const hot = fl > 0.02
        const X = hot ? F.x : far ? Fa.x : N.x
        const glyphA = mask * A * (1 - melt)
        if (glyphA > 0.01) {
          X.globalAlpha = Math.min(1, glyphA * (hot ? lerp(base, 1, fl) : base * fdim))
          X.fillStyle = hot ? mixHex(color, EVENTS[tk.ev].strong ? '#FFE6B8' : '#D9F0E6', fl * 0.75) : color
          X.textAlign = 'center'; X.textBaseline = 'middle'
          if (cjk) {
            X.font = `400 ${st.cjk}px ${FONT.serif}`
            X.fillText(ch, x, y)
          } else {
            // 로마자·숫자는 옆으로 눕혀 세로로 흐른다
            X.font = `400 ${st.size}px ${FONT.mono}`
            X.save(); X.translate(x, y); X.rotate(Math.PI / 2); X.fillText(ch, 0, 1); X.restore()
          }
        }
        if (S && streak > 0) {
          // 가운데로 끌려가는 빛줄기(바깥쪽으로 꼬리)
          const dx = x - 540, dy = y - 760, dd = Math.hypot(dx, dy) || 1
          const tr = Math.min(dd, 60 * streak)
          S.x.globalAlpha = Math.min(1, mask * A * Math.min(1, streak * 1.4)) * 0.5
          S.x.strokeStyle = hot || col.kind === 'face' ? 'rgba(255,214,150,1)' : 'rgba(255,236,206,1)'
          S.x.lineWidth = 1.6
          S.x.lineCap = 'round'
          S.x.beginPath(); S.x.moveTo(x, y); S.x.lineTo(x + (dx / dd) * tr, y + (dy / dd) * tr); S.x.stroke()
        }
      }
    }
  })
  const rx = WIN.x - 20, ry = top - 40, rw = WIN.w + 40, rh = WIN.h + 80
  blurRegion(Fa.c, rx, ry, rw, rh, 1.8, 1)
  blurRegion(Fa.c, rx, ry, rw, rh, 9, 0.35, 'lighter')
  blurRegion(N.c, rx, ry, rw, rh, 0, 1)
  blurRegion(N.c, rx, ry, rw, rh, 7, 0.4, 'lighter')
  blurRegion(F.c, rx, ry, rw, rh, 0, 1)
  blurRegion(F.c, rx, ry, rw, rh, 4, 0.9, 'lighter')
  blurRegion(F.c, rx, ry, rw, rh, 18, 0.7, 'lighter')
  if (S) {
    // 빛줄기는 선이 아니라 빛의 올로 보이게 충분히 풀어 준다
    blurRegion(S.c, WIN.x - 60, top - 80, WIN.w + 120, WIN.h + 160, 2.4, 1, 'lighter')
    blurRegion(S.c, WIN.x - 60, top - 80, WIN.w + 120, WIN.h + 160, 12, 0.9, 'lighter')
  }
}
/** 사건별 빛의 선: 플레어된 글자 위아래에 계측 괄호, 그 사이를 빛 한 올이 왼쪽에서 오른쪽으로 긋는다 */
function linksFx(tc: number, alpha = 1) {
  if (alpha <= 0) return
  const cs = cols()
  const L = tmp()
  const x = L.x
  EVENTS.forEach((e, ei) => {
    const k = ease.inOut3(seg(tc, e.t - 0.02, e.t + 0.42))
    const fade = 1 - ease.sine(seg(tc, e.t + 0.62, e.t + 1.25))
    if (k <= 0 || fade <= 0) return
    const col = e.strong ? 'rgba(255,208,138,1)' : 'rgba(156,195,178,1)'
    const boxes = e.toks.map((tk) => {
      const cc = cs[tk.c]
      const t0 = cc.toks.find((q) => q.ev === ei && q.s === tk.s)!
      const y0 = t0.base - cc.v * tc
      return { x: cc.x, y: y0 + t0.len / 2, h: t0.len + 22 }
    }).sort((a, b) => a.x - b.x)
    x.globalAlpha = fade
    x.strokeStyle = col
    x.fillStyle = col
    x.lineWidth = 1.2
    // 계측 괄호(⌐ ¬): 글자 위아래에 짧게
    const kb = ease.out3(clamp(k * 1.6))
    boxes.forEach((b) => {
      const hw = 15 * kb, hk = 7
      for (const sgn of [-1, 1]) {
        const yy = b.y + (sgn * b.h) / 2
        x.beginPath()
        x.moveTo(b.x - hw, yy - sgn * hk); x.lineTo(b.x - hw, yy); x.lineTo(b.x + hw, yy); x.lineTo(b.x + hw, yy - sgn * hk)
        x.stroke()
      }
    })
    // 빛 한 올: 글자 사이를 지나며 잇는다(글자 자리는 비워 둔다)
    const pts = boxes.map((b) => [b.x, b.y] as const)
    const segs = pts.slice(1).map((p, i) => {
      const [x0, y0] = pts[i], [x1, y1] = p
      const dd = Math.hypot(x1 - x0, y1 - y0)
      const ux = (x1 - x0) / dd, uy = (y1 - y0) / dd
      return [x0 + ux * 24, y0 + uy * 24, x1 - ux * 24, y1 - uy * 24] as const
    })
    const total = segs.length
    segs.forEach(([x0, y0, x1, y1], i) => {
      const kk = clamp(k * total - i)
      if (kk <= 0) return
      x.beginPath(); x.moveTo(x0, y0); x.lineTo(lerp(x0, x1, kk), lerp(y0, y1, kk)); x.stroke()
    })
    // 빛이 닿은 마디의 점
    boxes.forEach((b, i) => {
      const kk = clamp(k * total - i + 1)
      if (kk <= 0) return
      x.globalAlpha = fade * ease.sine(kk)
      for (const s of [-1, 1]) { x.beginPath(); x.arc(b.x + s * 24, b.y, 1.8, 0, 6.283); x.fill() }
      x.globalAlpha = fade
    })
  })
  x.globalAlpha = 1
  blurRegion(L.c, WIN.x - 30, WIN.y, WIN.w + 60, WIN.h, 0, alpha)
  blurRegion(L.c, WIN.x - 30, WIN.y, WIN.w + 60, WIN.h, 6, 0.9 * alpha, 'lighter')
}
/** 창살(나무 살) — 아홉 칸의 경계와 칸마다 그어지는 빛의 세로선 */
function latticeFx(ta: number, alpha: number) {
  if (alpha <= 0) return
  for (let c = 1; c < 9; c++) {
    const x = WIN.x + (c * WIN.w) / 9
    hair(x, WIN.y, x, WIN.y + WIN.h, 'rgba(0,0,0,0.6)', 2, alpha)
  }
  const L = tmp()
  for (let c = 0; c < 9; c++) {
    const d = Math.abs(c - 4)
    const k = ease.out3(seg(ta, 0.3 + d * 0.05, 0.85 + d * 0.05))
    if (k <= 0) continue
    L.x.globalAlpha = 1 - 0.6 * ease.sine(seg(ta, 1.0, 1.7))
    const x = colX(c)
    const y1 = WIN.y + WIN.h, y0 = lerp(y1, WIN.y, k)
    const g = L.x.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(0.2, 'rgba(232,166,75,0.25)'); g.addColorStop(1, 'rgba(232,166,75,0.08)')
    L.x.strokeStyle = g; L.x.lineWidth = 1
    L.x.beginPath(); L.x.moveTo(x, y0); L.x.lineTo(x, y1); L.x.stroke()
  }
  blurRegion(L.c, WIN.x, WIN.y, WIN.w, WIN.h, 0, 0.7 * alpha, 'lighter')
  blurRegion(L.c, WIN.x, WIN.y, WIN.w, WIN.h, 5, 0.6 * alpha, 'lighter')
}
/** 아래: 대조 기록 — 증거물 대장처럼 칸을 맞춘 세 줄 */
function logFx(tc: number, alpha: number, blur = 0, rise = 0) {
  if (alpha <= 0) return
  const hk = ease.sine(seg(tc, 0.6, 1.1))
  const y0 = 1474 - rise
  text('對照', LX.n, y0, `400 32px ${FONT.serif}`, C.celadon, { alpha: 0.9 * hk * alpha, blur, spacing: 8 })
  text('형상 근거 × 문진 응답', LX.n + 104, y0 - 2, `400 28px ${FONT.sans}`, C.hanjiShadow, { alpha: 0.9 * hk * alpha, blur, spacing: 1 })
  text('FACE × SURVEY', LX.end, y0 - 3, `300 18px ${FONT.mono}`, C.ash, { align: 'right', alpha: 0.7 * hk * alpha, blur, spacing: 3 })
  lineA(LX.n, y0 + 28, LX.end, y0 + 28, ease.out3(seg(tc, 0.7, 1.4)), C.gold, 1, 0.4 * alpha)
  const mf = `300 24px ${FONT.mono}`, sf = `400 34px ${FONT.serif}`
  LOG.forEach((row, i) => {
    const k = seg(tc, EVENTS[i].t + 0.3, EVENTS[i].t + 0.95)
    if (k <= 0) return
    const y = LOG_Y[i] - rise
    const ra = alpha * (EVENTS[i].strong ? 1 : 0.74)
    const part = (d: number) => clamp(k * 2.2 - d)
    text(row.n, LX.n, y + 2, `italic 300 36px ${FONT.italic}`, C.gold, { alpha: ease.sine(clamp(k * 3)) * ra, blur })
    engraveMixed(row.face, LX.face, y, 24, C.amber, part(0), { alpha: ra, blur, hot: '#FFF4DC' })
    engrave('×', LX.x, y, mf, C.ash, part(0.5), { alpha: ra, blur })
    engraveMixed(row.q, LX.q, y, 24, C.celadon, part(0.6), { alpha: ra, blur })
    engrave(row.rel, LX.rel, y + 2, sf, C.hanji, part(0.85), { alpha: ra, blur })
    engrave('→', LX.arr, y, mf, C.ash, part(1.0), { alpha: ra, blur })
    engrave(row.type, LX.type, y + 2, sf, typeText(row.type), part(1.1), { alpha: ra, blur })
    if (row.note) text(row.note, LX.end, y, `400 28px ${FONT.sans}`, C.celadon, { align: 'right', alpha: ease.sine(part(1.2)) * ra * 0.9, blur })
    // 행 사이 가는 선
    if (i < 2) lineA(LX.face, y + 30, LX.end, y + 30, ease.out3(part(0.3)), C.ash, 1, 0.14 * ra)
  })
}
/** 창의 불이 낮아질 때: 아래로 갈수록 먹빛으로 잠기게(회색 판처럼 보이지 않게) */
function shadeWin(a: number) {
  if (a <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(a)
  const g = ctx.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h)
  g.addColorStop(0, 'rgba(20,12,4,0.05)'); g.addColorStop(0.4, 'rgba(8,7,6,0.4)'); g.addColorStop(1, 'rgba(5,6,7,0.78)')
  ctx.fillStyle = g
  ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h)
  ctx.restore()
}

const S13: Scene = {
  id: 'S13',
  act: '판독',
  title: '문진 대조',
  note: '렌즈가 한 점으로 닫히며 창의 불이 낮아지고, 창살 아홉 칸을 따라 장부·체질·문항·형상 글자 기둥이 위로 흐른다. 얼굴 근거와 문진 응답이 맞물리는 순간 그 글자들이 동시에 타오르고 빛이 선을 그어 잇는다.',
  dur: 3.5,
  render(t) {
    const T = T0.S13 + t
    const dim = ease.sine(seg(t, 0.1, 0.95))
    stage12(S12_DUR, {
      T,
      close: seg(t, 0, 0.8),
      ui: ease.sine(seg(t, 0, 0.45)),
      glow: lerp(0.92, 0.17, dim),
      faceA: lerp(1, 0.1, ease.sine(seg(t, 0.15, 1.3))),
      beamK: lerp(0.55, 0.2, dim),
      hud: false,
    })
    shadeWin(dim)
    latticeFx(t, ease.sine(seg(t, 0.25, 0.8)))
    columnsFx(t, t)
    linksFx(t)
    logFx(t, 1)
    header(HEAD_L, '')
    stageTag(1, '형상 판독', 1 - ease.sine(seg(t, 0.05, 0.28)))
    stageTag(2, '문진 대조', ease.sine(seg(t, 0.34, 0.68)))
  },
}

/* ───────── S14: 한 점의 빛, 그리고 침묵 ───────── */
const P0 = { x: 540, y: 760 }
function lightPoint(I: number, flare: number) {
  if (I <= 0) return
  const L = tmp()
  const { x, y } = P0
  const g = L.x.createRadialGradient(x, y, 0, x, y, 16)
  g.addColorStop(0, 'rgba(255,250,240,1)'); g.addColorStop(0.35, 'rgba(255,226,180,0.85)'); g.addColorStop(1, 'rgba(255,208,138,0)')
  L.x.fillStyle = g; L.x.beginPath(); L.x.arc(x, y, 16, 0, 6.283); L.x.fill()
  // 아나모픽 줄빛(가로)
  if (flare > 0) {
    const hw = 520 * flare
    const sg = L.x.createLinearGradient(x - hw, 0, x + hw, 0)
    sg.addColorStop(0, 'rgba(232,166,75,0)'); sg.addColorStop(0.42, 'rgba(255,208,138,0.55)'); sg.addColorStop(0.5, 'rgba(255,244,220,0.95)')
    sg.addColorStop(0.58, 'rgba(255,208,138,0.55)'); sg.addColorStop(1, 'rgba(232,166,75,0)')
    L.x.fillStyle = sg; L.x.fillRect(x - hw, y - 1.2, hw * 2, 2.4)
  }
  blurRegion(L.c, x - 560, y - 300, 1120, 600, 0, I, 'lighter')
  blurRegion(L.c, x - 560, y - 300, 1120, 600, 6, 0.9 * I, 'lighter')
  blurRegion(L.c, x - 560, y - 300, 1120, 600, 30, 0.7 * I, 'lighter')
  blurRegion(L.c, x - 560, y - 300, 1120, 600, 90, 0.6 * I, 'lighter')
}
/** 어둠 속 몇 개의 티끌(보케) */
function motes(T: number, a: number) {
  if (a <= 0) return
  const r = rng(303)
  const L = tmp()
  for (let i = 0; i < 9; i++) {
    const x0 = P0.x + (r() - 0.5) * 760, y0 = P0.y + (r() - 0.5) * 900
    const sp = 9 + r() * 12, ph = r() * 6.283, rr = r() < 0.4 ? 1.4 + r() : 5 + r() * 9
    const x = x0 + Math.sin(T * 0.3 + ph) * 26, y = y0 - (T - T0.S14) * sp + 20
    const al = (rr > 3 ? 0.1 + r() * 0.08 : 0.35 + r() * 0.3) * a * (0.7 + 0.3 * Math.sin(T * 1.4 + ph * 3))
    const g = L.x.createRadialGradient(x, y, 0, x, y, rr)
    g.addColorStop(0, `rgba(255,214,150,${al})`); g.addColorStop(0.75, `rgba(255,214,150,${al * 0.7})`); g.addColorStop(1, 'rgba(255,214,150,0)')
    L.x.fillStyle = g; L.x.beginPath(); L.x.arc(x, y, rr, 0, 6.283); L.x.fill()
  }
  blurRegion(L.c, 60, 200, W - 120, 1300, 1.2, 1)
  blurRegion(L.c, 60, 200, W - 120, 1300, 6, 0.6, 'lighter')
}

const S14: Scene = {
  id: 'S14',
  act: '판독',
  title: '한 점의 빛, 침묵',
  note: '창살이 닫히듯 글자 기둥이 가운데로 모여 빛줄기가 되어 한 점으로 거두어지고, 그 점이 가로로 길게 번쩍인 뒤 잦아든다. 2초 동안 어둠 속에 티끌 몇 개만 떠다닌다(사유의 방).',
  dur: 3,
  render(t) {
    const T = T0.S14 + t
    // S13 마지막 프레임에서 출발: 흐름은 늦춰지며 이어진다
    const tc = 3.5 + 0.55 * t - 0.25 * t * t * clamp(t)
    const dim = ease.sine(seg(t, 0.05, 0.7))
    stage12(S12_DUR, {
      T,
      close: 1,
      ui: 1,
      glow: lerp(0.17, 0, dim),
      faceA: lerp(0.1, 0, dim),
      beamK: lerp(0.2, 0, ease.sine(seg(t, 0, 0.8))),
      hud: false,
    })
    shadeWin(1)
    latticeFx(3.5, 1 - ease.sine(seg(t, 0.05, 0.55)))
    // 응집: 기둥이 먼저 가운데로 좁혀지고(창살이 닫히듯), 이어 위아래가 한 점으로
    const gather = (c: number, y: number) => {
      const d = Math.abs(c - 4) / 4
      const gx = ease.in2(seg(t, 0.02 + (1 - d) * 0.06, 0.55 + d * 0.06))
      const dy = Math.abs(y - P0.y) / 700
      const gy = ease.in2(seg(t, 0.2 + dy * 0.1, 0.78 + dy * 0.06))
      const g = Math.max(gx, gy)
      // 글자는 빛줄기로 녹아(melt, 단조 증가) 가운데에 닿기 전에 사라진다
      return { gx: g, gy, melt: ease.sine(seg(g, 0.3, 0.75)), streak: ease.sine(seg(g, 0.3, 0.7)) * (1 - ease.sine(seg(gy, 0.8, 0.97))) }
    }
    if (t < 0.95) columnsFx(tc, 3.5, { gather })
    linksFx(tc, 1 - seg(t, 0, 0.3))
    logFx(3.5, 1 - ease.sine(seg(t, 0, 0.45)), 8 * seg(t, 0, 0.45), 30 * ease.sine(seg(t, 0, 0.45)))
    // 한 점의 빛
    const I = ease.out3(seg(t, 0.5, 0.86)) * (1 - 0.86 * ease.sine(seg(t, 0.95, 1.7))) * (1 - ease.sine(seg(t, 1.7, 2.5)))
    const fl = ease.out3(seg(t, 0.72, 0.98)) * (1 - ease.sine(seg(t, 0.98, 1.6)))
    lightPoint(I, fl)
    motes(T, ease.sine(seg(t, 1.0, 1.9)) * (1 - 0.35 * ease.sine(seg(t, 2.5, 3))))
    const ha = 1 - ease.sine(seg(t, 1.05, 1.8))
    header(HEAD_L, '', ha)
    stageTag(2, '문진 대조', (1 - ease.sine(seg(t, 0.02, 0.22))) * ha)
    stageTag(3, '종합', ease.sine(seg(t, 0.28, 0.58)) * ha)
  },
}

export const scenes: Scene[] = [S12, S13, S14]
