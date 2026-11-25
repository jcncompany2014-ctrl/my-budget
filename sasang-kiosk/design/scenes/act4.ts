/**
 * 4막 문진 — S10 족자와 문항, S11 응답의 날인
 * 셔터 섬광의 잔광 속에서 렌즈 속 먹 초상이 위로 걸려 족자(掛軸)가 되고, 족자가 아래로 풀리며
 * 네 갈래 먹줄기(太陰·少陽·少陰·太陽)가 드러난다. 그 아래 어둠에는 문항과 네 장의 한지 창호 패널.
 * 응답을 짚으면 그 창만 등불이 오르고 나머지는 먹에 잠기며, 빛이 선을 그어 族子의 太陰 줄기를 굵게 한다.
 */
import {
  C, FONT, H, W, TYPE_COL, bloom, clamp, ctx, disclaimer, drawBlur, drawFace, dust, ease, face, hair, hanji, header, layer, lerp,
  mono, rng, seg, setCtx, text, tickRing, tmp, vignette, type Face, type Scene,
} from '../engine'

/* ───────── 무대 치수 ───────── */
/** S06~S09의 판독 렌즈(이 막의 첫 프레임이 이어받는다) */
const LENS = { x: 540, y: 760, r: 390 }
const FACE_W = 480
/** 렌즈 → 족자 축척 */
const PS = 0.48
/** 족자 화심(그림 면, 화면 좌표). bot0: 초상만 걸린 상태, bot: 다 풀린 상태 */
const IMG = { x: 360, w: 360, top: 172, bot0: 542, bot: 782 }
/** 족자 표구(비단 테) */
const MOUNT = { x: 326, w: 428, top: 146, foot: 20 }
/** 렌즈 공간에서 화심 윗변 */
const SRC_TOP = LENS.y - (IMG.bot0 - IMG.top) / PS / 2
/** 족자에 걸렸을 때 얼굴 중심 y(화면) */
const FACE_Y = IMG.top + (LENS.y - SRC_TOP) * PS

/** 아래 60%: 문진 */
const Q = { x: 124, r: 1008, numY: 948, ruleY: 980, qY: 1050 }
const PANE = { x: 124, w: 884, y0: 1096, h: 146, gap: 18 }
const paneY = (i: number) => PANE.y0 + i * (PANE.h + PANE.gap)
const TICK = { x: 64, y0: 880, dy: 50.4 }
/** 손끝이 닿는 자리(첫 패널) */
const TP = { x: 742, y: PANE.y0 + PANE.h / 2 }

/** 먹줄기와 이름표 */
const LBL = [
  { k: 'taeeum', s: '太陰', x: 405, ink: '#1F4A35' },
  { k: 'soyang', s: '少陽', x: 495, ink: '#6E3418' },
  { k: 'soeum', s: '少陰', x: 585, ink: '#25386C' },
  { k: 'taeyang', s: '太陽', x: 675, ink: '#3A352C' },
] as const
const STR = { y0: 512, y1: 694, lab: 724 }

/** 문항 */
const QS = {
  q07: {
    n: 7, tag: 'Q07 · 汗', q: '땀은 어떻게 나나요?',
    a: ['땀이 많고, 흘리면 개운하다', '머리·가슴 위주로 나고 열이 오른다', '땀을 흘리면 기운이 빠진다', '땀이 별로 없는 편이다'],
  },
  q08: {
    n: 8, tag: 'Q08 · 脾胃', q: '평소 소화는 어떤가요?',
    a: ['잘 먹고, 소화도 잘 되는 편이다', '빨리 먹고, 금방 배가 고파진다', '조금만 먹어도 더부룩하다', '입맛이 그때그때 다르다'],
  },
}
/** 문진 누적 경향(태음·소양·소음) — 07번까지 / 08번 응답(①=太陰) 후 */
const WT7 = [0.46, 0.31, 0.23]
const WT8 = [0.5, 0.29, 0.21]
/** 전역 시각(먼지 흐름이 장면 경계에서 끊기지 않게) */
const T0 = { S10: 0, S11: 3.5 }

/* ───────── 로컬 도우미 ───────── */
const frac = (v: number) => v - Math.floor(v)
/** ctx를 임시 레이어로 돌려 그린다 */
function onLayer(fn: () => void, L = tmp()) {
  const main = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(main) }
  return L
}
/** 영역만 잘라 흐리게 합성(전체 화면 블러보다 싸다) */
function blurRegion(src: HTMLCanvasElement, x: number, y: number, w: number, h: number, blur: number, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0) return
  const pad = Math.ceil(blur * 3) + 2
  const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad))
  const x1 = Math.min(W, Math.ceil(x + w + pad)), y1 = Math.min(H, Math.ceil(y + h + pad))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = op
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}
/** 알파를 존중하는 부분 선 */
function lineA(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  hair(x0, y0, lerp(x0, x1, k), lerp(y0, y1, k), color, w, alpha)
}
/** 꺾인 선을 길이 기준 k만큼 그린다. 끝점 반환 */
function polyline(pts: [number, number][], k: number): [number, number] {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  let left = lens.reduce((a, b) => a + b, 0) * clamp(k)
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  let end: [number, number] = pts[0]
  for (let i = 0; i < lens.length && left > 0; i++) {
    const f = Math.min(1, left / lens[i])
    end = [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]
    ctx.lineTo(end[0], end[1])
    left -= lens[i]
  }
  return end
}
/** 글자별로 먹이 맺히듯 나타나는 가로 텍스트(왼쪽 정렬). k 0→1 */
function inkLine(s: string, x: number, y: number, font: string, color: string, k: number, o: { spacing?: number; alpha?: number; blur?: number } = {}) {
  const alpha = o.alpha ?? 1
  if (k <= 0 || alpha <= 0) return
  const sp = o.spacing ?? 0
  ctx.save(); ctx.font = font; ctx.letterSpacing = '0px'
  const chars = [...s]
  const ws = chars.map((ch) => ctx.measureText(ch).width)
  ctx.restore()
  const n = chars.length
  const st = 0.06
  let xx = x
  chars.forEach((ch, i) => {
    const kk = clamp(k * (1 + (n - 1) * st) - i * st)
    if (ch !== ' ' && kk > 0) text(ch, xx, y, font, color, { alpha: ease.sine(kk) * alpha, blur: (1 - ease.out3(kk)) * 8 + (o.blur ?? 0) })
    xx += ws[i] + sp
  })
}
/** 세로 글자(가운데 정렬, 기준선 middle) */
function vchars(s: string, x: number, y: number, size: number, font: string, color: string, alpha: number, gap = 1.2, blur = 0) {
  if (alpha <= 0) return
  ;[...s].forEach((ch, i) => text(ch, x, y + i * size * gap, `${size}px ${font}`, color, { align: 'center', baseline: 'middle', alpha, blur }))
}

/* ───── 캐시 레이어(정적, 1회 굽기) ───── */
/** 먹점 얼굴(1막 inkFace와 같은 화법: 담묵 음영 + 먹점, 입가 완화) */
function inkPortrait(f: Face, dot = 1) {
  const L = tmp()
  const Wl = tmp()
  const mx = (f.lm[61].x + f.lm[291].x) / 2, my = (f.lm[13].y + f.lm[14].y) / 2, mw = Math.abs(f.lm[291].x - f.lm[61].x) / 2
  for (const p of f.pts) {
    const mu = ((p.x - mx) / (mw * 1.2)) ** 2 + ((p.y - my) / (mw * 0.42)) ** 2
    const calm = p.edge && mu < 1 ? 0.6 : 1
    const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5) * calm
    if (p.r < 0.13) {
      Wl.x.fillStyle = `rgba(28,24,20,${0.018 + (1 - p.s) ** 2 * 0.11})`
      Wl.x.beginPath(); Wl.x.arc(p.x, p.y, (7 + p.r * 60) * dot, 0, 6.283); Wl.x.fill()
    }
    L.x.fillStyle = `rgba(12,13,15,${a})`
    const rad = (p.edge ? 1.4 + p.r * 1.6 : 0.8 + p.r * 0.9) * dot
    L.x.beginPath(); L.x.arc(p.x, p.y, rad, 0, 6.283); L.x.fill()
  }
  drawBlur(Wl.c, 10 * dot)
  drawBlur(L.c, 5 * dot, 0.5)
  ctx.drawImage(L.c, 0, 0)
}
let portraitC: HTMLCanvasElement | null = null
/** 렌즈 공간의 한지 + 먹 초상(아래로 족자가 풀릴 여백까지 길게) */
function portraitCache() {
  if (portraitC) return portraitC
  const P = layer()
  onLayer(() => {
    hanji(150, 370, 780, 1290, 1, { halo: false })
    inkPortrait(face(LENS.x, LENS.y, FACE_W))
  }, P)
  portraitC = P.c
  return portraitC
}
let silkC: HTMLCanvasElement | null = null
/** 표구 비단(한지보다 짙고 누른 결) */
function silkCache() {
  if (silkC) return silkC
  const P = layer()
  onLayer(() => hanji(MOUNT.x, MOUNT.top, MOUNT.w, 700, 1, { halo: false }), P)
  P.x.globalCompositeOperation = 'multiply'
  P.x.fillStyle = 'rgba(132,104,66,1)'
  P.x.fillRect(MOUNT.x, MOUNT.top, MOUNT.w, 700)
  // 비단 가로 결
  P.x.globalCompositeOperation = 'source-atop'
  const r = rng(61)
  for (let y = MOUNT.top; y < MOUNT.top + 700; y += 3) {
    P.x.fillStyle = `rgba(${r() < 0.5 ? '255,236,200' : '40,30,18'},${0.03 + r() * 0.05})`
    P.x.fillRect(MOUNT.x, y, MOUNT.w, 1)
  }
  silkC = P.c
  return silkC
}
let paneC: HTMLCanvasElement | null = null
/** 네 장의 창호 한지 패널(역광) + 안쪽 테 그림자 */
function paneCache() {
  if (paneC) return paneC
  const P = layer()
  onLayer(() => { for (let i = 0; i < 4; i++) hanji(PANE.x, paneY(i), PANE.w, PANE.h, 1, { halo: false }) }, P)
  P.x.globalCompositeOperation = 'multiply'
  for (let i = 0; i < 4; i++) {
    const y = paneY(i)
    const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, a: number) => {
      const g = P.x.createLinearGradient(x0, y0, x1, y1)
      g.addColorStop(0, `rgba(96,74,48,${a})`); g.addColorStop(1, 'rgba(96,74,48,0)')
      P.x.fillStyle = g; P.x.fillRect(rx, ry, rw, rh)
    }
    edge(0, y, 0, y + 16, PANE.x, y, PANE.w, 16, 0.5)
    edge(0, y + PANE.h, 0, y + PANE.h - 12, PANE.x, y + PANE.h - 12, PANE.w, 12, 0.35)
    edge(PANE.x, 0, PANE.x + 14, 0, PANE.x, y, 14, PANE.h, 0.45)
    edge(PANE.x + PANE.w, 0, PANE.x + PANE.w - 14, 0, PANE.x + PANE.w - 14, y, 14, PANE.h, 0.45)
    // 등불은 가운데 뒤에: 양 끝이 약간 어둡다
    const g = P.x.createRadialGradient(PANE.x + PANE.w * 0.5, y + PANE.h * 0.45, 40, PANE.x + PANE.w * 0.5, y + PANE.h * 0.5, PANE.w * 0.62)
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,96,64,0.55)')
    P.x.fillStyle = g; P.x.fillRect(PANE.x, y, PANE.w, PANE.h)
  }
  paneC = P.c
  return paneC
}
let beamC: HTMLCanvasElement | null = null
/** 천장 빛기둥(족자 위로 떨어지는 좁은 원뿔) */
function beamCache() {
  if (beamC) return beamC
  const P = layer()
  const S = layer()
  const cx = W / 2, hh = 900
  const trap = (wf: number, a: number, top: number, bot: number) => {
    const g = S.x.createLinearGradient(0, 0, 0, hh)
    g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.18, `rgba(244,184,104,${a * 0.55})`)
    g.addColorStop(0.5, `rgba(232,166,75,${a * 0.16})`); g.addColorStop(1, 'rgba(232,166,75,0)')
    S.x.fillStyle = g
    S.x.beginPath(); S.x.moveTo(cx - top * wf / 2, 0); S.x.lineTo(cx + top * wf / 2, 0); S.x.lineTo(cx + bot * wf / 2, hh); S.x.lineTo(cx - bot * wf / 2, hh); S.x.closePath(); S.x.fill()
  }
  for (const [wf, a] of [[1.1, 0.2], [0.75, 0.2], [0.45, 0.2]] as const) trap(wf, a, 130, 640)
  P.x.filter = 'blur(34px)'
  P.x.drawImage(S.c, 0, 0)
  P.x.filter = 'none'
  const g = P.x.createRadialGradient(cx, -30, 0, cx, -30, 230)
  g.addColorStop(0, 'rgba(255,226,170,0.5)'); g.addColorStop(0.45, 'rgba(255,200,120,0.14)'); g.addColorStop(1, 'rgba(255,200,120,0)')
  P.x.fillStyle = g
  P.x.fillRect(0, 0, W, 300)
  beamC = P.c
  return beamC
}

/* ───────── 족자 ───────── */
interface ScrollO {
  T: number
  morph: number // 0 렌즈 → 1 족자
  unroll: number // 0 초상만 → 1 다 풀림
  paper: number // 화심 밝기
  mount: number // 표구·축 등장
  heads: number[] // 먹줄기 흐름 진행(0→1)
  answered: number // 지금까지 답한 문항 수(줄기 굵기)
  wt: number[] // 태음·소양·소음 경향
  pulse?: number // 太陰 줄기를 타고 내려가는 먹 덩이(0→1)
  tauGlow?: number // 太陰 이름표 뒤 한지에 석록 빛
  beam: number
}
const imgBot = (u: number) => lerp(IMG.bot0, IMG.bot, u)

/** 렌즈 공간 → 화면 변환과 클립 모양 */
function portraitFx(m: number, u: number, alpha: number) {
  const s = lerp(1, PS, m)
  const cy = lerp(LENS.y, FACE_Y, m)
  const w = lerp(LENS.r * 2, IMG.w / PS, m)
  const h0 = lerp(LENS.r * 2, (IMG.bot0 - IMG.top) / PS, m)
  const top = LENS.y - h0 / 2
  const h = h0 + (u * (IMG.bot - IMG.bot0)) / PS
  const rad = Math.min(w / 2, h0 / 2, LENS.r * (1 - ease.sine(m)))
  ctx.save()
  ctx.translate(LENS.x, cy); ctx.scale(s, s); ctx.translate(-LENS.x, -LENS.y)
  ctx.beginPath(); ctx.roundRect(LENS.x - w / 2, top, w, h, rad); ctx.clip()
  ctx.globalAlpha = alpha
  ctx.drawImage(portraitCache(), 0, 0)
  ctx.restore()
  return { s, cy }
}

/** 베지어 위의 점·접선 */
function bez(i: number, s: number) {
  const x0 = 522 + i * 12, lx = LBL[i].x
  const P = [x0, STR.y0, x0, 590, lx, 604, lx, STR.y1]
  const u = 1 - s
  const x = u * u * u * P[0] + 3 * u * u * s * P[2] + 3 * u * s * s * P[4] + s * s * s * P[6]
  const y = u * u * u * P[1] + 3 * u * u * s * P[3] + 3 * u * s * s * P[5] + s * s * s * P[7]
  const dx = 3 * u * u * (P[2] - P[0]) + 6 * u * s * (P[4] - P[2]) + 3 * s * s * (P[6] - P[4])
  const dy = 3 * u * u * (P[3] - P[1]) + 6 * u * s * (P[5] - P[3]) + 3 * s * s * (P[7] - P[5])
  const l = Math.hypot(dx, dy) || 1
  return { x, y, nx: -dy / l, ny: dx / l }
}
/** 먹줄기 굵기(px): 답한 문항이 쌓일수록, 경향이 클수록 굵다 */
const thick = (w: number, answered: number) => 2.2 + 30 * w * Math.sqrt(clamp(answered / 18))

/** 네 갈래 먹줄기 + 이름표 (화심 위, 화면 좌표) */
function streams(o: ScrollO) {
  const bot = imgBot(o.unroll)
  const L = tmp()
  const x = L.x
  for (let i = 0; i < 3; i++) {
    const head = o.heads[i]
    if (head <= 0) continue
    const tw = thick(o.wt[i], o.answered)
    const N = 56
    const left: [number, number][] = [], right: [number, number][] = []
    for (let j = 0; j <= N; j++) {
      const s = (head * j) / N
      const p = bez(i, s)
      const w = tw * (0.28 + 0.72 * ease.out3(clamp(s / 0.42))) * (1 + 0.09 * Math.sin(s * 19 + i * 2.1 + o.T * 1.3)) / 2
      left.push([p.x + p.nx * w, p.y + p.ny * w])
      right.push([p.x - p.nx * w, p.y - p.ny * w])
    }
    x.fillStyle = 'rgba(10,11,12,0.86)'
    x.beginPath()
    left.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b)))
    for (let j = right.length - 1; j >= 0; j--) x.lineTo(right[j][0], right[j][1])
    x.closePath(); x.fill()
    // 흐름 끝(먹이 맺힌 방울)
    const hp = bez(i, head)
    x.beginPath(); x.arc(hp.x, hp.y, tw * 0.62, 0, 6.283); x.fill()
    // 흘러내리는 농묵 마디
    for (let j = 0; j < 3; j++) {
      const sb = frac(o.T * (0.16 + 0.05 * i) + j / 3 + i * 0.17)
      if (sb > head) continue
      const p = bez(i, sb)
      x.fillStyle = 'rgba(4,4,5,0.55)'
      x.beginPath(); x.ellipse(p.x, p.y, tw * 0.55, tw * 0.9, 0, 0, 6.283); x.fill()
    }
  }
  // 太陽: 판별 제외 — 점선 실가닥
  if (o.heads[3] > 0) {
    for (let s = 0; s < o.heads[3]; s += 0.035) {
      const p = bez(3, s)
      x.fillStyle = 'rgba(20,18,15,0.38)'
      x.beginPath(); x.arc(p.x, p.y, 1.1, 0, 6.283); x.fill()
    }
  }
  // 太陰 줄기를 타고 내려가는 먹 덩이
  if (o.pulse != null && o.pulse > 0 && o.pulse < 1) {
    const p = bez(0, o.pulse)
    const tw = thick(o.wt[0], o.answered)
    x.fillStyle = 'rgba(3,3,4,0.92)'
    x.beginPath(); x.ellipse(p.x, p.y, tw * 0.8, tw * 1.5, 0, 0, 6.283); x.fill()
  }
  ctx.save()
  ctx.beginPath(); ctx.rect(IMG.x, IMG.top, IMG.w, bot - IMG.top); ctx.clip()
  blurRegion(L.c, IMG.x, STR.y0 - 20, IMG.w, 240, 4, 0.5) // 섬유로 번진 테
  blurRegion(L.c, IMG.x, STR.y0 - 20, IMG.w, 240, 0.7, 0.95)
  // 太陰 이름표 뒤로 번지는 석록 빛
  const tg = o.tauGlow ?? 0
  if (tg > 0) {
    ctx.globalCompositeOperation = 'screen'
    const g = ctx.createRadialGradient(LBL[0].x, STR.lab + 18, 0, LBL[0].x, STR.lab + 18, 92)
    g.addColorStop(0, `rgba(120,200,150,${0.42 * tg})`); g.addColorStop(1, 'rgba(120,200,150,0)')
    ctx.fillStyle = g; ctx.fillRect(LBL[0].x - 100, STR.lab - 80, 200, 200)
    ctx.globalCompositeOperation = 'source-over'
  }
  // 이름표(세로쓰기, 석채 먹)
  LBL.forEach((lb, i) => {
    const a = clamp((o.heads[i] - 0.7) / 0.3)
    if (a <= 0) return
    const ex = lb.k === 'taeyang'
    const col = i === 0 && tg > 0 ? mixHex(lb.ink, '#0E3B26', tg) : lb.ink
    vchars(lb.s, lb.x, STR.lab, 28, `400 ${FONT.serif}`, col, (ex ? 0.3 : 0.9) * a, 1.22)
    if (ex) vchars('판별제외', lb.x + 25, STR.lab - 6, 13, `500 ${FONT.sans}`, '#3A352C', 0.42 * a, 1.25)
  })
  ctx.restore()
}
function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (n: number, sh: number) => Math.round(lerp((n >> sh) & 255, (pb >> sh) & 255, k))
  return `rgb(${ch(pa, 16)},${ch(pa, 8)},${ch(pa, 0)})`
}

/** 표구: 비단 테, 금니 일문자선, 천간(위 막대)·끈, 축(아래 막대) */
function mounting(k: number, u: number) {
  if (k <= 0) return
  const bot = imgBot(u)
  const foot = bot + MOUNT.foot
  ctx.save()
  ctx.beginPath(); ctx.rect(MOUNT.x, MOUNT.top, MOUNT.w, foot - MOUNT.top); ctx.clip()
  ctx.globalAlpha = 0.42 * k
  ctx.drawImage(silkCache(), 0, 0)
  ctx.restore()
  // 화심 둘레 금니 실선(빛이 선을 긋는다)
  ctx.save()
  ctx.strokeStyle = C.gold
  ctx.globalAlpha = 0.6 * k
  ctx.lineWidth = 1
  const gk = ease.out3(k)
  const cx = IMG.x + IMG.w / 2
  ctx.beginPath()
  ctx.moveTo(cx - (IMG.w / 2) * gk, IMG.top - 6.5); ctx.lineTo(cx + (IMG.w / 2) * gk, IMG.top - 6.5)
  ctx.moveTo(cx - (IMG.w / 2) * gk, bot + 6.5); ctx.lineTo(cx + (IMG.w / 2) * gk, bot + 6.5)
  ctx.stroke()
  ctx.restore()
  // 끈과 고리
  const hook = 124
  lineA(540, hook, MOUNT.x + 64, MOUNT.top - 10, k, C.hanjiDeep, 1, 0.45)
  lineA(540, hook, MOUNT.x + MOUNT.w - 64, MOUNT.top - 10, k, C.hanjiDeep, 1, 0.45)
  ctx.save(); ctx.globalAlpha = 0.6 * k; ctx.strokeStyle = C.hanjiDeep; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(540, hook + 4, 4, 0, 6.283); ctx.stroke(); ctx.restore()
  rod(MOUNT.x - 6, MOUNT.x + MOUNT.w + 6, MOUNT.top - 10, 10, k)
  rod(MOUNT.x - 12, MOUNT.x + MOUNT.w + 12, foot, 15, k, true)
}
function rod(x0: number, x1: number, y: number, h: number, a: number, knobs = false) {
  ctx.save()
  ctx.globalAlpha = a
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, '#6a5136'); g.addColorStop(0.3, '#2c2016'); g.addColorStop(1, '#0c0907')
  ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, h)
  ctx.fillStyle = 'rgba(255,214,150,0.4)'; ctx.fillRect(x0 + 4, y, x1 - x0 - 8, 1)
  if (knobs) {
    for (const kx of [x0 - 14, x1]) {
      const kg = ctx.createLinearGradient(0, y - 3, 0, y + h + 3)
      kg.addColorStop(0, '#d9cbb0'); kg.addColorStop(0.45, '#8f8269'); kg.addColorStop(1, '#2a241b')
      ctx.fillStyle = kg; ctx.fillRect(kx, y - 3, 14, h + 6)
    }
  }
  ctx.restore()
}

/** 족자 전체 */
function scrollFx(o: ScrollO) {
  mounting(o.mount, o.unroll)
  portraitFx(o.morph, o.unroll, o.paper)
  if (o.morph >= 1) streams(o)
  // 빛기둥과 먼지(족자를 위에서 비춘다)
  if (o.beam > 0) {
    drawBlur(beamCache(), 0, o.beam, 'screen')
    dust(W / 2, 120, 560, 840, 240, o.T, 9, '255,214,150', 0.75 * o.beam)
  }
}

/* ───────── 문진 영역 ───────── */
/** 18 눈금 세로 자. v: 현재 문항(연속값, 앰버 표식이 미끄러진다), k: 자 그리기 진행 */
function ruler(v: number, k: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return
  const y0 = TICK.y0, y1 = TICK.y0 + 17 * TICK.dy
  const yk = lerp(y0 - 24, y1 + 24, ease.out3(k))
  hair(TICK.x, y0 - 24, TICK.x, yk, C.celadon, 1, 0.3 * alpha)
  const cur = Math.round(v)
  for (let i = 0; i < 18; i++) {
    const y = y0 + i * TICK.dy
    if (y > yk) break
    const n = i + 1
    const major = n === 1 || n % 6 === 0
    if (n < cur) hair(TICK.x, y, TICK.x + (major ? 22 : 14), y, C.hanji, 1.4, 0.78 * alpha)
    else if (n > cur) hair(TICK.x, y, TICK.x + (major ? 16 : 9), y, C.celadon, 1, 0.32 * alpha)
  }
  // 앰버 표식(현재 문항)
  const my = y0 + (v - 1) * TICK.dy
  if (my <= yk) {
    const L = tmp()
    L.x.strokeStyle = C.amberCore; L.x.lineWidth = 2
    L.x.beginPath(); L.x.moveTo(TICK.x - 10, my); L.x.lineTo(TICK.x + 34, my); L.x.stroke()
    L.x.fillStyle = C.amberCore
    L.x.beginPath(); L.x.moveTo(TICK.x - 16, my - 5); L.x.lineTo(TICK.x - 9, my); L.x.lineTo(TICK.x - 16, my + 5); L.x.closePath(); L.x.fill()
    blurRegion(L.c, 30, my - 12, 80, 24, 0, alpha)
    blurRegion(L.c, 30, my - 12, 80, 24, 6, 0.8 * alpha, 'lighter')
  }
  mono('01', TICK.x - 12, y0 + 5, C.ash, 13, 'right', 0.6 * alpha * clamp(k * 3))
  mono('18', TICK.x - 12, y1 + 5, C.ash, 13, 'right', 0.6 * alpha * clamp(k * 3 - 2))
}

/** 진행 숫자(Cormorant 이탤릭). v 연속값: 정수 사이에서 멈췄다가 굴러 넘어간다 */
function counter(v: number, alpha: number) {
  if (alpha <= 0) return
  const n = Math.floor(v + 1e-6), f = v - n
  const kk = ease.inOut3(clamp((f - 0.3) / 0.7))
  const font = `italic 300 128px ${FONT.italic}`
  const lh = 104
  const pad = (k: number) => String(k).padStart(2, '0')
  ctx.save()
  ctx.beginPath(); ctx.rect(Q.x - 10, Q.numY - 104, 170, 130); ctx.clip()
  text(pad(n), Q.x, Q.numY - kk * lh, font, C.hanji, { alpha: alpha * (1 - kk), blur: kk * 7 })
  if (kk > 0) text(pad(n + 1), Q.x, Q.numY + (1 - kk) * lh, font, C.hanji, { alpha: alpha * kk, blur: (1 - kk) * 7 })
  ctx.restore()
  text('/ 18', Q.x + 142, Q.numY, `italic 300 46px ${FONT.italic}`, C.gold, { alpha: alpha * 0.85, spacing: 2 })
}

/** 질문 머리: 번호, 금니 선, 꼬리표, 질문 */
function questionHead(q: typeof QS.q07, o: { rule: number; tag: number; q: number; alpha?: number; blur?: number }) {
  const a = o.alpha ?? 1
  const b = o.blur ?? 0
  if (o.rule > 0) {
    const L = tmp()
    L.x.strokeStyle = C.gold; L.x.lineWidth = 1
    L.x.beginPath(); L.x.moveTo(Q.x, Q.ruleY + 0.5); L.x.lineTo(lerp(Q.x, Q.r, ease.out3(o.rule)), Q.ruleY + 0.5); L.x.stroke()
    blurRegion(L.c, Q.x, Q.ruleY - 2, Q.r - Q.x, 4, b, 0.55 * a)
  }
  if (o.tag > 0) text(q.tag, Q.r, Q.numY - 10, `300 19px ${FONT.mono}`, C.celadon, { align: 'right', spacing: 2, alpha: 0.85 * o.tag * a, blur: b })
  inkLine(q.q, Q.x, Q.qY, `300 52px ${FONT.hahmlet}`, C.hanji, o.q, { spacing: 1, alpha: a, blur: b })
}

const NUM = ['一', '二', '三', '四']
/** 창호 패널 한 장(역광 한지) */
function paneFx(i: number, glow: number) {
  if (glow <= 0) return
  const y = paneY(i)
  ctx.save()
  ctx.globalAlpha = clamp(glow)
  ctx.drawImage(paneCache(), PANE.x, y, PANE.w, PANE.h, PANE.x, y, PANE.w, PANE.h)
  ctx.restore()
}
/** 패널 위 먹 글씨: 번호(세로 계선으로 구획) + 답 */
function paneText(i: number, s: string, k: number, o: { alpha?: number; blur?: number } = {}) {
  const a = o.alpha ?? 1
  if (k <= 0 || a <= 0) return
  const y = paneY(i), cy = y + PANE.h / 2
  const b = o.blur ?? 0
  const e = ease.sine(clamp(k * 1.6))
  text(NUM[i], PANE.x + 54, cy + 11, `400 30px ${FONT.serif}`, '#17130F', { align: 'center', alpha: 0.78 * e * a, blur: b + (1 - e) * 6 })
  hair(PANE.x + 100, y + 30, PANE.x + 100, lerp(y + 30, y + PANE.h - 30, e), '#17130F', 1, 0.28 * a)
  inkLine(s, PANE.x + 134, cy + 12, `500 35px ${FONT.sans}`, '#16120E', clamp(k * 1.25 - 0.2), { spacing: 0.5, alpha: 0.94 * a, blur: b })
}

/** 손끝 그림자: 오른쪽 아래에서 다가와 접점으로 모인다. k 0(멀다)→1(닿음) */
function fingerShadow(tx: number, ty: number, k: number, alpha: number) {
  if (alpha <= 0) return
  const L = tmp()
  const off = 1 - k
  L.x.translate(tx + off * 90, ty + off * 130)
  L.x.rotate(Math.atan2(1, 0.45) - Math.PI / 2)
  L.x.fillStyle = 'rgb(46,32,20)'
  L.x.beginPath(); L.x.arc(0, 30, 30, Math.PI, 0); L.x.lineTo(44, 420); L.x.lineTo(-44, 420); L.x.closePath(); L.x.fill()
  L.x.beginPath(); L.x.ellipse(40, 620, 160, 210, 0.22, 0, 6.283); L.x.fill()
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 4; i++) ctx.rect(PANE.x, paneY(i), PANE.w, PANE.h)
  ctx.clip()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = alpha * (0.18 + 0.36 * k)
  ctx.filter = `blur(${5 + off * 36}px)`
  ctx.drawImage(L.c, 0, 0)
  ctx.restore()
}

/** 번짐 전선(여러 주파수 사인 합) */
function frontPath(x: CanvasRenderingContext2D, cx: number, cy: number, R: number, ph: number[], amp: number) {
  x.beginPath()
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2
    const m = 1 + amp * (0.5 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(7 * a + ph[1]) + 0.18 * Math.sin(13 * a + ph[2]) + 0.08 * Math.sin(29 * a + ph[3]))
    const rr = R * m
    if (i === 0) x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.62)
    else x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.62)
  }
  x.closePath()
}
/** 고르지 않은 패널들이 먹에 잠긴다: ks[i] 0→1 (i=0은 무시) */
function inkFlood(ks: number[]) {
  if (ks.every((k) => k <= 0)) return
  const L = tmp()
  const x = L.x
  ks.forEach((k, i) => {
    if (k <= 0 || i === 0) return
    const y = paneY(i)
    const r = rng(300 + i * 17)
    const ox = TP.x + (r() - 0.5) * 160, oy = y - 8
    const e = ease.inOut3(k)
    const R = 30 + 980 * e
    x.save()
    x.beginPath(); x.rect(PANE.x, y, PANE.w, PANE.h); x.clip()
    const ph = [r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283]
    const ph2 = ph.map((p) => p + 1.7)
    x.fillStyle = 'rgba(8,9,10,0.5)'; frontPath(x, ox, oy, R * 1.1, ph, 0.22); x.fill()
    x.strokeStyle = 'rgba(6,7,8,0.5)'; x.lineWidth = 3; frontPath(x, ox, oy, R * 1.1, ph, 0.22); x.stroke()
    x.fillStyle = 'rgba(6,7,8,0.82)'; frontPath(x, ox, oy, R * 0.86, ph2, 0.26); x.fill()
    // 섬유를 타고 뻗는 실번짐
    x.lineCap = 'round'
    for (let j = 0; j < 70; j++) {
      const a = r() * 6.283
      const d = R * 1.1 * (0.96 + r() * 0.06)
      let px = ox + Math.cos(a) * d, py = oy + Math.sin(a) * d * 0.62
      let aa = a + (r() - 0.5) * 1.2
      const len = (8 + r() * 46) * (0.3 + e)
      x.strokeStyle = `rgba(8,9,10,${0.2 + r() * 0.3})`
      x.lineWidth = 0.6 + r() * 1.6
      x.beginPath(); x.moveTo(px, py)
      for (let st = 0; st < 3; st++) { aa += (r() - 0.5) * 0.7; px += (Math.cos(aa) * len) / 3; py += (Math.sin(aa) * len) / 3; x.lineTo(px, py) }
      x.stroke()
    }
    x.restore()
  })
  blurRegion(L.c, PANE.x, paneY(1), PANE.w, paneY(3) + PANE.h - paneY(1), 3.5)
}
/** 패널 안 먹 방울 파문: 떨어진 먹이 번지고, 고리가 종이 결을 타고 퍼진다 */
function inkRipple(k: number) {
  if (k <= 0 || k >= 1) return
  const y = paneY(0)
  ctx.save()
  ctx.beginPath(); ctx.rect(PANE.x, y, PANE.w, PANE.h); ctx.clip()
  // 먹 방울(번졌다가 종이에 스며 옅어진다)
  const kd = ease.ink(clamp(k / 0.55))
  const rr = 5 + 30 * kd
  const ca = 0.8 * (1 - ease.sine(clamp((k - 0.25) / 0.75)))
  const g = ctx.createRadialGradient(TP.x, TP.y, 0, TP.x, TP.y, rr)
  g.addColorStop(0, `rgba(8,9,10,${ca})`); g.addColorStop(0.7, `rgba(10,11,12,${ca * 0.6})`); g.addColorStop(1, 'rgba(10,11,12,0)')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(TP.x, TP.y, rr, 0, 6.283); ctx.fill()
  for (let j = 0; j < 3; j++) {
    const kk = clamp((k - j * 0.12) / 0.78)
    if (kk <= 0 || kk >= 1) continue
    const R = 20 + 420 * ease.out3(kk)
    ctx.strokeStyle = `rgba(24,18,12,${0.5 * (1 - kk)})`
    ctx.lineWidth = 2.2 - j * 0.5
    ctx.beginPath(); ctx.arc(TP.x, TP.y, R, 0, 6.283); ctx.stroke()
    ctx.strokeStyle = `rgba(255,226,170,${0.5 * (1 - kk)})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(TP.x, TP.y, R + 4, 0, 6.283); ctx.stroke()
  }
  ctx.restore()
}
/** 선택된 패널 테두리: 접점에서 양쪽으로 앰버 빛이 선을 긋는다 */
function amberEdge(k: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  const y = paneY(0), x0 = PANE.x, x1 = PANE.x + PANE.w, y1 = y + PANE.h
  const kh = ease.out3(clamp(k / 0.7)), kv = ease.out3(clamp((k - 0.55) / 0.45))
  const L = tmp()
  const x = L.x
  x.strokeStyle = C.amberCore; x.lineWidth = 2
  x.beginPath()
  for (const yy of [y + 1, y1 - 1]) {
    x.moveTo(TP.x, yy); x.lineTo(lerp(TP.x, x0 + 1, kh), yy)
    x.moveTo(TP.x, yy); x.lineTo(lerp(TP.x, x1 - 1, kh), yy)
  }
  if (kv > 0) {
    for (const xx of [x0 + 1, x1 - 1]) {
      x.moveTo(xx, y + 1); x.lineTo(xx, lerp(y + 1, y + PANE.h / 2, kv))
      x.moveTo(xx, y1 - 1); x.lineTo(xx, lerp(y1 - 1, y + PANE.h / 2, kv))
    }
  }
  x.stroke()
  blurRegion(L.c, x0, y, PANE.w, PANE.h, 0, alpha)
  blurRegion(L.c, x0, y, PANE.w, PANE.h, 7, 0.9 * alpha, 'lighter')
  blurRegion(L.c, x0, y, PANE.w, PANE.h, 22, 0.5 * alpha, 'lighter')
}
/** 패널 뒤로 등불이 오를 때 바깥으로 새는 빛 */
function paneHalo(i: number, k: number) {
  if (k <= 0) return
  const L = tmp()
  L.x.fillStyle = 'rgba(255,226,170,1)'
  L.x.fillRect(PANE.x, paneY(i), PANE.w, PANE.h)
  blurRegion(L.c, PANE.x, paneY(i), PANE.w, PANE.h, 46, 0.32 * k, 'screen')
}

/* ───────── S10 ───────── */
const S10: Scene = {
  id: 'S10',
  act: '문진',
  title: '족자와 문항',
  note: '셔터 섬광의 잔광 속에서 렌즈 속 먹 초상이 위로 걸려 족자가 되고, 족자가 풀리며 네 갈래 먹줄기가 太陰·少陽·少陰(太陽은 판별 제외)으로 흘러내린다. 아래 어둠에는 앰버 표식이 01에서 07로 미끄러지며 질문이 맺히고, 네 장의 한지 창호에 차례로 등불이 든다.',
  dur: 3.5,
  render(t) {
    const T = T0.S10 + t
    const morph = ease.inOut3(seg(t, 0.3, 1.35))
    const unroll = ease.inOut3(seg(t, 1.2, 1.95))
    const v = 1 + 6 * ease.inOut3(seg(t, 1.55, 2.55))
    const answered = v - 1
    const heads = [0, 1, 2, 3].map((i) => ease.out3(seg(t, 1.32 + i * 0.07, 2.1 + i * 0.07)))
    const upBlur = 1.3 * ease.sine(seg(t, 2.0, 2.8))
    const so: ScrollO = {
      T, morph, unroll, heads, answered, wt: WT7,
      paper: lerp(0.98, 0.64, morph),
      mount: ease.sine(seg(t, 0.95, 1.6)),
      beam: 0.8 * ease.sine(seg(t, 0.9, 2.0)),
    }
    // ── 위: 족자 (초점이 문항으로 넘어가며 살짝 흐려진다)
    if (upBlur > 0.2) {
      const L = onLayer(() => scrollFx(so))
      blurRegion(L.c, 0, 0, W, 880, upBlur)
    } else scrollFx(so)
    // 렌즈 잔상: 청자 72눈금 링과 앰버 점구름이 먹 초상으로 타 들어간다
    const ring = 1 - ease.sine(seg(t, 0.0, 0.55))
    if (ring > 0) {
      const s = lerp(1, PS, morph), cy = lerp(LENS.y, FACE_Y, morph)
      ctx.save(); ctx.globalAlpha = ring
      ctx.translate(LENS.x, cy); ctx.scale(s, s); ctx.translate(-LENS.x, -LENS.y)
      tickRing(LENS.x, LENS.y, LENS.r + 12, 72, 1, C.celadon, C.celadonDeep, 6, 16)
      ctx.restore()
    }
    const amb = 1 - ease.sine(seg(t, 0.0, 0.5))
    if (amb > 0.01) drawFace(face(LENS.x, LENS.y, FACE_W), 'amber', { alpha: amb * 0.8, glow: amb * 0.7 })
    // 셔터 섬광의 꼬리
    const fl = 1 - ease.out3(seg(t, 0, 0.6))
    if (fl > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const g = ctx.createRadialGradient(LENS.x, LENS.y, 0, LENS.x, LENS.y, 900)
      g.addColorStop(0, `rgba(255,246,228,${0.75 * fl})`); g.addColorStop(0.45, `rgba(255,240,215,${0.35 * fl})`); g.addColorStop(1, `rgba(255,240,215,${0.08 * fl})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }

    // ── 아래: 문진
    ruler(v, seg(t, 1.35, 2.05))
    counter(v, ease.sine(seg(t, 1.45, 1.8)))
    questionHead(QS.q07, { rule: seg(t, 1.55, 2.25), tag: ease.sine(seg(t, 2.2, 2.6)), q: seg(t, 2.05, 2.85) })
    for (let i = 0; i < 4; i++) {
      const g = 0.5 * ease.sine(seg(t, 2.3 + i * 0.12, 2.8 + i * 0.12))
      paneFx(i, g)
      paneText(i, QS.q07.a[i], seg(t, 2.45 + i * 0.12, 3.15 + i * 0.12))
    }

    vignette(0.55)
    header('墨光判讀室 · INK-LIGHT READING ROOM', '問診 · SURVEY')
    disclaimer(1)
  },
}

/* ───────── S11 ───────── */
const S11: Scene = {
  id: 'S11',
  act: '문진',
  title: '응답의 날인',
  note: '손끝이 첫 번째 창에 닿자 먹 방울이 떨어져 파문이 번지고, 그 창에만 등불이 오르며 앰버 빛이 테두리를 긋는다. 나머지 창은 먹에 잠기고, 빛의 선이 족자로 올라가 太陰 줄기가 굵어진다. 표식이 08로 내려가며 다음 질문이 초점 속으로 들어온다.',
  dur: 3.5,
  render(t) {
    const T = T0.S11 + t
    const touch = 0.45
    // 카메라: 닿기 전 살짝 다가갔다가 빛이 위로 올라갈 때 물러선다
    const push = 1 + 0.02 * ease.sine(seg(t, 0, 0.55)) * (1 - ease.sine(seg(t, 1.0, 2.0)))
    const wt = WT7.map((w, i) => lerp(w, WT8[i], ease.sine(seg(t, 1.55, 2.1))))
    const answered = 6 + ease.sine(seg(t, 1.55, 2.1))
    const pulse = seg(t, 1.3, 1.95)
    const tauGlow = ease.sine(seg(t, 1.7, 2.05)) * (1 - 0.65 * ease.sine(seg(t, 2.4, 3.3)))
    const upBlur = 1.3 * (1 - ease.sine(seg(t, 1.0, 1.4))) + 1.3 * ease.sine(seg(t, 2.1, 2.6))
    const lowBlur = 3.2 * ease.sine(seg(t, 1.05, 1.45)) * (1 - ease.sine(seg(t, 1.95, 2.35)))
    const so: ScrollO = { T, morph: 1, unroll: 1, heads: [1, 1, 1, 1], answered, wt, pulse, tauGlow, paper: 0.64, mount: 1, beam: 0.8 }

    ctx.save()
    ctx.translate(W / 2, TP.y); ctx.scale(push, push); ctx.translate(-W / 2, -TP.y)
    // ── 위: 족자 (빛이 올라오면 초점이 족자로 옮겨 간다)
    if (upBlur > 0.2) {
      const L = onLayer(() => scrollFx(so))
      blurRegion(L.c, 0, 0, W, 880, upBlur)
    } else scrollFx(so)

    // ── 아래: 07 문항 → 응답 → 08 문항
    const v = 7 + seg(t, 2.0, 2.5)
    const old = 1 - ease.sine(seg(t, 1.95, 2.4))
    const lower = () => {
      ruler(v, 1)
      counter(v, 1)
      if (old > 0) questionHead(QS.q07, { rule: 1, tag: old, q: 1, alpha: old, blur: (1 - old) * 8 })
      else questionHead(QS.q07, { rule: 1, tag: 0, q: 0 })
      // 선택된 창: 등불이 오르고, 다른 창은 먹에 잠긴다
      const lit = ease.out3(seg(t, touch, touch + 0.45))
      const floods = [0, 1, 2, 3].map((i) => (i === 0 ? 0 : seg(t, 0.68 + (i - 1) * 0.1, 1.5 + (i - 1) * 0.1)))
      const g0 = (0.5 + 0.5 * lit) * old
      paneHalo(0, lit * old)
      paneFx(0, g0)
      for (let i = 1; i < 4; i++) paneFx(i, 0.5 * (1 - ease.sine(clamp((floods[i] - 0.2) / 0.8))))
      inkRipple(seg(t, touch, touch + 1.1))
      fingerShadow(TP.x, TP.y, ease.out3(seg(t, 0, touch)), 1 - ease.sine(seg(t, touch + 0.05, touch + 0.5)))
      paneText(0, QS.q07.a[0], 1, { alpha: old, blur: (1 - old) * 8 })
      for (let i = 1; i < 4; i++) paneText(i, QS.q07.a[i], 1, { alpha: 1 - ease.sine(floods[i]), blur: 6 * floods[i] })
      inkFlood(floods)
      amberEdge(seg(t, touch + 0.05, touch + 0.55), old)
    }
    if (lowBlur > 0.2) {
      const L = onLayer(lower)
      blurRegion(L.c, 0, 840, W, 940, lowBlur)
    } else lower()
    // 다음 문항: 초점 밖에서 들어온다
    const nq = seg(t, 2.3, 2.95)
    if (nq > 0) {
      questionHead(QS.q08, { rule: 0, tag: ease.sine(seg(t, 2.35, 2.75)), q: nq })
      for (let i = 0; i < 4; i++) {
        paneFx(i, 0.5 * ease.sine(seg(t, 2.45 + i * 0.1, 2.95 + i * 0.1)))
        paneText(i, QS.q08.a[i], seg(t, 2.55 + i * 0.1, 3.2 + i * 0.1))
      }
    }

    // 빛이 선을 긋는다: 선택한 창 → 족자의 太陰
    const lk = ease.inOut3(seg(t, 0.95, 1.45))
    const la = 1 - ease.sine(seg(t, 2.1, 2.5))
    if (lk > 0 && la > 0) {
      const ly = STR.lab + 17
      const pts: [number, number][] = [[PANE.x - 1, TP.y], [100, TP.y], [100, ly], [LBL[0].x - 22, ly]]
      const L = onLayer(() => {
        ctx.strokeStyle = C.amberCore; ctx.lineWidth = 1.6
        const end = polyline(pts, lk)
        ctx.stroke()
        ctx.fillStyle = C.amberCore
        ctx.beginPath(); ctx.arc(end[0], end[1], 3.2, 0, 6.283); ctx.fill()
      })
      blurRegion(L.c, 80, ly - 20, 360, TP.y - ly + 40, 0, la)
      blurRegion(L.c, 80, ly - 20, 360, TP.y - ly + 40, 6, 0.8 * la, 'lighter')
      const na = ease.sine(seg(t, 1.4, 1.7)) * la
      mono('Q07 · ① → 太陰', 116, ly - 14, C.amber, 15, 'left', na)
      mono(`+${(WT8[0] - WT7[0]).toFixed(2).slice(1)}`, 116, ly + 30, C.amberCore, 15, 'left', na)
    }
    ctx.restore()

    vignette(0.55)
    header('墨光判讀室 · INK-LIGHT READING ROOM', '問診 · SURVEY')
    disclaimer(1)
  },
}

export const scenes: Scene[] = [S10, S11]
