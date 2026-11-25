/**
 * 4막 문진 — S10 족자와 문항, S11 응답의 날인
 * S09의 채록 렌즈를 그대로 이어받아 계측선을 거두고, 렌즈가 표구에 싸여 위로 걸려 족자(掛軸)가 된다.
 * 족자가 아래로 풀리며 네 갈래 먹줄기(太陰·少陽·少陰·太陽)가 드러나고, 그 아래 어둠에는 문항과 네 장의 한지 창.
 * 응답을 짚으면 그 창만 등불이 오르고 나머지는 먹에 잠기며, 빛이 선을 그어 족자의 太陰 줄기를 굵게 한다.
 */
import {
  C, FONT, H, W, clamp, ctx, disclaimer, drawBlur, dust, ease, face, hair, hanji, header, layer, lerp,
  mono, rng, seg, setCtx, text, tmp, vignette, type Face, type Scene,
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
const STR = { y0: 512, y1: 688, lab: 718 }

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
/**
 * 웹폰트 하위 집합(unicode-range) 미리 받기: 캔버스는 아직 받지 않은 글리프를 대체 글꼴로 그린다.
 * 이 막을 처음 그리는 프레임(또는 S11 마지막 프레임을 캐시로 굽는 5막 S12)에서 글자 폭이 달라지지 않게 한다.
 */
if (typeof document !== 'undefined' && document.fonts) {
  const ko = [...QS.q07.a, ...QS.q08.a, QS.q07.q, QS.q08.q, '형상을 담았습니다', '판별제외', '눈 너비 비코턱'].join('')
  const hz = '一二三四太陰少陽天人地上停中停下停髮際眉間鼻下頤端目鼻廣光心推定汗脾胃①→·'
  for (const f of [`400 37px ${FONT.serif}`, `200 40px ${FONT.serif}`, `300 52px ${FONT.hahmlet}`, `500 20px ${FONT.sans}`, `400 20px ${FONT.sans}`, `300 20px ${FONT.mono}`])
    document.fonts.load(f, ko + hz).catch(() => undefined)
}
/** 문진 누적 경향(태음·소양·소음) — 07번까지 / 08번 응답(①=太陰) 후 */
const WT7 = [0.46, 0.31, 0.23]
const WT8 = [0.54, 0.27, 0.19]
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
let measureX: CanvasRenderingContext2D | null = null
function measurer() {
  if (!measureX) measureX = document.createElement('canvas').getContext('2d')!
  return measureX
}
/** 글자별로 먹이 맺히듯 나타나는 가로 텍스트(왼쪽 정렬). k 0→1 */
function inkLine(s: string, x: number, y: number, font: string, color: string, k: number, o: { spacing?: number; alpha?: number; blur?: number } = {}) {
  const alpha = o.alpha ?? 1
  if (k <= 0 || alpha <= 0) return
  const sp = o.spacing ?? 0
  // 글자 폭은 늘 같은 분리 캔버스에서 잰다: 화면 캔버스와 오프스크린 레이어가 공백 폭을 다르게 재서
  // (블러 레이어로 그릴 때나 5막이 S11 마지막 프레임을 캐시로 구울 때) 글자 자리가 밀리지 않게
  const M = measurer()
  M.font = font
  const chars = [...s]
  const ws = chars.map((ch) => M.measureText(ch).width)
  const n = chars.length
  const st = 0.06
  let xx = x
  chars.forEach((ch, i) => {
    const kk = clamp(k * (1 + (n - 1) * st) - i * st)
    if (ch !== ' ' && kk > 0) text(ch, xx, y, font, color, { alpha: ease.sine(kk) * alpha, blur: (1 - ease.out3(kk)) * 8 + (o.blur ?? 0) })
    xx += ws[i] + sp
  })
}
/** 세로 글자(가운데 정렬, 기준선 middle). weight는 크기 앞에 와야 유효한 font 문자열이 된다 */
function vchars(s: string, x: number, y: number, size: number, family: string, color: string, alpha: number, gap = 1.2, blur = 0, weight = 400) {
  if (alpha <= 0) return
  ;[...s].forEach((ch, i) => text(ch, x, y + i * size * gap, `${weight} ${size}px ${family}`, color, { align: 'center', baseline: 'middle', alpha, blur }))
}

/* ───── S09 잔상: 앞 장면 마지막 프레임을 그대로 이어받아 거둬들인다 ───── */
const S9 = { scaleX: 128, profX: 968, eye: { x: 540, y: 246 }, ring: 398, guideY: 1612 }
const ZONE = [
  { hz: '天', name: '上停', ratio: '0.27' },
  { hz: '人', name: '中停', ratio: '0.33' },
  { hz: '地', name: '下停', ratio: '0.39' },
]
const LTAG = ['髮際', '眉間', '鼻下', '頤端']
function zones(f: Face) {
  const brow = f.lm[9].y, base = f.lm[2].y, chin = f.lm[152].y
  return { top: brow - (base - brow) * (0.27 / 0.33), brow, base, chin }
}
function readSpec(f: Face) {
  const L = f.lm
  const eyeY = Math.max(L[263].y, L[362].y) + 24
  const noseY = (L[358].y + L[129].y) / 2
  const jawY = (L[397].y + L[172].y) / 2 + 6
  const top = 1236
  const jx = (L[397].x + L[172].x) / 2
  return [
    { hz: '目', val: '0.22', ko: '눈 너비 비', x: 210, span: [L[263].x, L[362].x, eyeY], lead: [[L[263].x, eyeY], [210, eyeY], [210, top]] as [number, number][] },
    { hz: '鼻廣', val: '0.35', ko: '코 너비 비', x: 870, span: [L[358].x, L[129].x, noseY], lead: [[L[129].x, noseY], [870, noseY], [870, top]] as [number, number][] },
    { hz: '頤', val: '0.80', ko: '턱 너비 비', x: 540, span: [L[397].x, L[172].x, jawY], lead: [[jx, jawY], [jx, top]] as [number, number][] },
  ]
}
/** 선을 가운데로 거둬들인다(빛이 선을 긋는 동작의 역재생). k: 1 온전 → 0 사라짐 */
function retract(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
  hair(lerp(mx, x0, k), lerp(my, y0, k), lerp(mx, x1, k), lerp(my, y1, k), color, w, alpha)
}
/** 꺾인 지시선을 끝(수치 쪽)에서부터 거둬들인다 */
function retractPoly(pts: [number, number][], k: number, color: string, w: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha
  polyline(pts, k); ctx.stroke(); ctx.restore()
}
/** 잔상 배경(렌즈 주변 방의 빛): 방 잔광, 렌즈 할로 */
function s09Room(k: number) {
  if (k <= 0) return
  const g = ctx.createRadialGradient(S9.eye.x, -160, 10, S9.eye.x, -160, 1000)
  g.addColorStop(0, `rgba(232,166,75,${0.16 * k})`); g.addColorStop(0.45, `rgba(232,166,75,${0.045 * k})`); g.addColorStop(1, 'rgba(232,166,75,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const h = ctx.createRadialGradient(LENS.x, LENS.y, LENS.r * 0.92, LENS.x, LENS.y, LENS.r * 1.8)
  h.addColorStop(0, `rgba(241,230,207,${0.12 * 0.95 * k})`); h.addColorStop(0.3, `rgba(232,200,150,${0.045 * 0.95 * k})`); h.addColorStop(1, 'rgba(232,200,150,0)')
  ctx.fillStyle = h; ctx.fillRect(0, 0, W, H)
}
/** 렌즈에 붙은 기물(금 테·72눈금). 렌즈와 함께 족자 쪽으로 움직인다 — 호출 측에서 변환 */
function s09Lens(k: number) {
  if (k <= 0) return
  ctx.save()
  ctx.strokeStyle = C.gold
  ctx.globalAlpha = 0.62 * k; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.arc(LENS.x, LENS.y, LENS.r + 0.5, 0, 6.283); ctx.stroke()
  ctx.globalAlpha = 0.16 * k; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(LENS.x, LENS.y, LENS.r + 6, 0, 6.283); ctx.stroke()
  ctx.restore()
  for (let i = 0; i < 72; i++) {
    const a = -Math.PI / 2 + (i / 72) * Math.PI * 2
    const major = i % 6 === 0
    const len = major ? 16 : 8
    const c = Math.cos(a), s = Math.sin(a)
    hair(LENS.x + c * S9.ring, LENS.y + s * S9.ring, LENS.x + c * (S9.ring + len), LENS.y + s * (S9.ring + len), C.celadon, major ? 1.8 : 1.1, (major ? 0.86 : 0.69) * k)
  }
}
/** 계측 도해·판독값·안내 — 텍스트는 흐려지며, 선은 가운데로 거둬진다. r: 0(S09 마지막 프레임) → 1(모두 걷힘) */
function s09Overlay(f: Face, r: number) {
  if (r >= 1) return
  const Z = zones(f)
  const ys = [Z.top, Z.brow, Z.base, Z.chin]
  const ta = 1 - ease.sine(seg(r, 0, 0.62)), tb = ease.sine(seg(r, 0, 0.62)) * 9
  const lk = 1 - ease.inOut3(seg(r, 0.08, 1))
  // 계측선(렌즈 밖 청자 / 렌즈 안 짙은 청자)
  const lines = (col: string) => {
    ys.forEach((y) => retract(S9.scaleX + 18, y, S9.profX - 16, y, lk, col, 1, 0.55))
    if (lk > 0) {
      ctx.save(); ctx.setLineDash([5, 7]); ctx.strokeStyle = col; ctx.globalAlpha = 0.33; ctx.lineWidth = 1
      const mx = f.lm[168].x, my = (Z.top + Z.chin) / 2, hh = ((Z.chin - Z.top) / 2) * lk
      ctx.beginPath(); ctx.moveTo(mx, my - hh); ctx.lineTo(mx, my + hh); ctx.stroke(); ctx.restore()
    }
    for (const sp of readSpec(f)) {
      retract(sp.span[0], sp.span[2], sp.span[1], sp.span[2], lk, col, 1.2, 0.62)
      for (const x of [sp.span[0], sp.span[1]]) retract(x, sp.span[2] - 9, x, sp.span[2] + 9, lk, col, 1.2, 0.62)
      retractPoly(sp.lead, ease.inOut3(seg(lk, 0.25, 1)), col, 1, 0.49)
    }
  }
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(LENS.x, LENS.y, LENS.r, 0, 6.283); ctx.clip('evenodd')
  lines(C.celadon)
  ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.arc(LENS.x, LENS.y, LENS.r, 0, 6.283); ctx.clip()
  lines(C.celadonDeep)
  ctx.restore()
  // 계측 기둥
  retract(S9.scaleX, Z.top, S9.scaleX, Z.chin, lk, C.celadon, 1, 0.5)
  for (const y of ys) retract(S9.scaleX - 8, y, S9.scaleX + 18, y, lk, C.celadon, 1.4, 0.7)
  // 광심과 수직 기준선
  const E = S9.eye
  retract(E.x, E.y + 40, E.x, LENS.y - S9.ring - 26, lk, C.celadon, 1, 0.45)
  if (ta > 0) {
    ctx.save(); ctx.strokeStyle = C.celadon; ctx.lineWidth = 1
    ctx.globalAlpha = 0.34 * ta; ctx.beginPath(); ctx.arc(E.x, E.y, 17, 0, 6.283); ctx.stroke()
    ctx.globalAlpha = 0.14 * ta; ctx.beginPath(); ctx.arc(E.x, E.y, 31, 0, 6.283); ctx.stroke()
    ctx.restore()
    for (const d of [-1, 1]) hair(E.x + d * 40, E.y, E.x + d * 64, E.y, C.celadon, 1, 0.4 * ta)
    text('光心', E.x + 78, E.y + 6, `400 17px ${FONT.serif}`, C.celadon, { alpha: 0.62 * ta, spacing: 4, blur: tb })
    const L = tmp()
    L.x.fillStyle = 'rgba(255,226,170,1)'
    L.x.beginPath(); L.x.arc(E.x, E.y, 3.4, 0, 6.283); L.x.fill()
    L.x.fillStyle = 'rgba(255,226,170,0.18)'
    L.x.beginPath(); L.x.arc(E.x, E.y, 9, 0, 6.283); L.x.fill()
    blurRegion(L.c, E.x - 20, E.y - 20, 40, 40, 0, ta)
    blurRegion(L.c, E.x - 20, E.y - 20, 40, 40, 4, 0.85 * ta, 'lighter')
    blurRegion(L.c, E.x - 20, E.y - 20, 40, 40, 16, 0.5 * ta, 'lighter')
  }
  if (ta <= 0) return
  // 삼정 라벨·비율
  ys.forEach((y, i) => text(LTAG[i], S9.scaleX - 14, y + 6, `400 15px ${FONT.serif}`, C.celadon, { align: 'right', alpha: 0.7 * ta, spacing: 1, blur: tb }))
  mono('推定', S9.scaleX + 26, Z.top - 10, C.ash, 13, 'left', 0.7 * ta)
  ZONE.forEach((z, i) => {
    const ym = (ys[i] + ys[i + 1]) / 2
    text(z.hz, 82, ym - 4, `200 40px ${FONT.serif}`, C.hanji, { align: 'center', alpha: ta, blur: tb })
    ;[...z.name].forEach((ch, j) => text(ch, 82, ym + 30 + j * 21, `400 17px ${FONT.serif}`, C.celadon, { align: 'center', alpha: 0.8 * ta, blur: tb }))
    text(z.ratio, W - 70, ym + 10, `300 26px ${FONT.mono}`, C.hanji, { align: 'right', alpha: ta, blur: tb, spacing: 26 * 0.08 })
  })
  // 아래 판독값
  for (const sp of readSpec(f)) {
    text(sp.hz, sp.x, 1290, `200 32px ${FONT.serif}`, C.celadon, { align: 'center', alpha: ta, blur: tb, spacing: 4 })
    text(sp.val, sp.x, 1352, `300 46px ${FONT.mono}`, C.pearl, { align: 'center', alpha: ta, blur: tb, spacing: 46 * 0.08 })
    text(sp.ko, sp.x, 1392, `400 19px ${FONT.sans}`, C.hanjiShadow, { align: 'center', alpha: 0.9 * ta, blur: tb, spacing: 1 })
  }
  mono('FRAME 01 · 판독 후 즉시 폐기', W - 72, 372, C.ash, 15, 'right', 0.8 * ta)
  text('형상을 담았습니다', W / 2, S9.guideY, `300 46px ${FONT.hahmlet}`, C.hanji, { align: 'center', spacing: 3, alpha: ta, blur: tb })
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
  /** 太陰 줄기: 먹 덩이가 지나간 자리부터 굵어진다(px, 이전→이후) */
  fresh?: { from: number; to: number }
  /** 줄기별 굵기 직접 지정(px) */
  tws?: number[]
  tauGlow?: number // 太陰 이름표 뒤 한지에 석록 빛
  beam: number
}
const imgBot = (u: number) => lerp(IMG.bot0, IMG.bot, u)

/** 렌즈 공간 → 화면 변환 */
function lensSpace(m: number) {
  const s = lerp(1, PS, m)
  const cy = lerp(LENS.y, FACE_Y, m)
  ctx.translate(LENS.x, cy); ctx.scale(s, s); ctx.translate(-LENS.x, -LENS.y)
}
/**
 * 렌즈 → 족자. 둥근 렌즈의 한지빛은 그대로 줄어들며 꺼지고, 그 둘레로 족자의 네모난 화심이 먹처럼 배어 나온다.
 * (모양을 모핑하지 않는다 — 중간에 둥근 사각형이 생기지 않게)
 */
function portraitFx(m: number, u: number, alpha: number) {
  const w = IMG.w / PS
  const h0 = (IMG.bot0 - IMG.top) / PS
  const top = LENS.y - h0 / 2
  const h = h0 + (u * (IMG.bot - IMG.bot0)) / PS
  const rectA = clamp((m - 0.04) / 0.86)
  const lensA = 1 - ease.sine(clamp((m - 0.28) / 0.72))
  ctx.save()
  lensSpace(m)
  if (rectA >= 1) {
    ctx.save()
    ctx.beginPath(); ctx.rect(LENS.x - w / 2, top, w, h); ctx.clip()
    ctx.globalAlpha = alpha
    ctx.drawImage(portraitCache(), 0, 0)
    ctx.restore()
  } else if (rectA > 0) {
    // 렌즈 가장자리에서 바깥으로 한지가 배어 나온다(번짐 전선은 부드럽게)
    const main = ctx
    const L = onLayer(() => {
      ctx.setTransform(main.getTransform())
      ctx.beginPath(); ctx.rect(LENS.x - w / 2, top, w, h); ctx.clip()
      ctx.drawImage(portraitCache(), 0, 0)
      ctx.globalCompositeOperation = 'destination-in'
      const r0 = LENS.r * 0.84 + 320 * rectA ** 1.3
      const g = ctx.createRadialGradient(LENS.x, LENS.y, r0, LENS.x, LENS.y, r0 + 150)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(LENS.x - w / 2, top, w, h)
    })
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alpha * ease.sine(clamp(rectA * 2.2))
    ctx.drawImage(L.c, 0, 0)
    ctx.restore()
  }
  if (lensA > 0) {
    ctx.save()
    ctx.beginPath(); ctx.arc(LENS.x, LENS.y, LENS.r, 0, 6.283); ctx.clip()
    // 표구가 둘러지면 렌즈빛은 화심 안에만 남는다(둥근 빛이 비단 테 위로 삐져나오지 않게). 첫 프레임은 S09 렌즈 그대로
    const e = lerp(40, 0, ease.sine(clamp((m - 0.04) / 0.3)))
    ctx.beginPath(); ctx.rect(LENS.x - w / 2 - e, top - e, w + 2 * e, h + 2 * e); ctx.clip()
    ctx.globalAlpha = 0.94 * lensA
    ctx.drawImage(portraitCache(), 0, 0)
    // 렌즈 경통 그늘과 천장 광원 쪽 온기(S09의 렌즈 한지와 같은 결)
    ctx.globalAlpha = lensA
    ctx.globalCompositeOperation = 'screen'
    const hg = ctx.createRadialGradient(S9.eye.x, LENS.y - LENS.r - 60, 0, S9.eye.x, LENS.y - LENS.r - 60, 560)
    hg.addColorStop(0, 'rgba(255,214,150,0.42)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.12)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
    ctx.fillStyle = hg; ctx.fillRect(LENS.x - LENS.r, LENS.y - LENS.r, LENS.r * 2, LENS.r * 2)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = lensA * (1 - ease.sine(clamp(m / 0.55)))
    const g = ctx.createRadialGradient(LENS.x, LENS.y, LENS.r * 0.45, LENS.x, LENS.y, LENS.r)
    g.addColorStop(0, 'rgba(46,34,20,0)'); g.addColorStop(0.72, 'rgba(46,34,20,0.14)'); g.addColorStop(0.93, 'rgba(30,22,14,0.42)'); g.addColorStop(1, 'rgba(10,8,6,0.86)')
    ctx.fillStyle = g; ctx.fillRect(LENS.x - LENS.r, LENS.y - LENS.r, LENS.r * 2, LENS.r * 2)
    ctx.restore()
  }
  ctx.restore()
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
const thick = (w: number, answered: number) => 2 + 50 * w * Math.sqrt(clamp(answered / 18))

/** 네 갈래 먹줄기 + 이름표 (화심 위, 화면 좌표) */
function streams(o: ScrollO) {
  const bot = imgBot(o.unroll)
  const L = tmp()
  const x = L.x
  for (let i = 0; i < 3; i++) {
    const head = o.heads[i]
    if (head <= 0) continue
    const tw = o.tws ? o.tws[i] : thick(o.wt[i], o.answered)
    const fr = i === 0 ? o.fresh : undefined
    const pk = o.pulse ?? 1
    /** 먹 덩이 위쪽(지나간 자리)은 새 굵기, 아래는 이전 굵기 */
    const twAt = (s: number) => (fr ? lerp(fr.from, fr.to, pk >= 1 ? 1 : clamp((pk - s) / 0.1)) : tw)
    const N = 56
    const left: [number, number][] = [], right: [number, number][] = []
    for (let j = 0; j <= N; j++) {
      const s = (head * j) / N
      const p = bez(i, s)
      // 붓끝: 흐름의 앞 14%는 가늘게 모인다
      const tip = lerp(1, 0.32, ease.sine(clamp((s - head + 0.14) / 0.14)))
      const w = twAt(s) * (0.28 + 0.72 * ease.out3(clamp(s / 0.42))) * tip * (1 + 0.09 * Math.sin(s * 19 + i * 2.1 + o.T * 1.3)) / 2
      left.push([p.x + p.nx * w, p.y + p.ny * w])
      right.push([p.x - p.nx * w, p.y - p.ny * w])
    }
    // 초상 아래에서 배어 나와(위는 옅다), 이름표에 닿으며 그 체질의 석채로 물든다
    const pg = x.createLinearGradient(0, STR.y0, 0, STR.y1 + 6)
    const pig = parseInt(LBL[i].ink.slice(1), 16)
    const pc = `${(pig >> 16) & 255},${(pig >> 8) & 255},${pig & 255}`
    pg.addColorStop(0, 'rgba(10,11,12,0)'); pg.addColorStop(0.2, 'rgba(10,11,12,0.86)')
    pg.addColorStop(0.6, 'rgba(10,11,12,0.86)'); pg.addColorStop(1, `rgba(${pc},0.9)`)
    x.fillStyle = pg
    x.beginPath()
    left.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b)))
    for (let j = right.length - 1; j >= 0; j--) x.lineTo(right[j][0], right[j][1])
    x.closePath(); x.fill()
    // 흐르는 동안의 젖은 앞머리(이름표에 닿으면 붓끝으로 거둬진다)
    const hp = bez(i, head)
    const bead = twAt(head) * 0.5 * (1 - ease.sine(clamp((head - 0.82) / 0.18)))
    if (bead > 0.3) { x.beginPath(); x.arc(hp.x, hp.y, bead, 0, 6.283); x.fill() }
    // 흘러내리는 농묵 마디
    for (let j = 0; j < 3; j++) {
      const sb = frac(o.T * (0.16 + 0.05 * i) + j / 3 + i * 0.17)
      if (sb > head) continue
      const p = bez(i, sb)
      const tws = twAt(sb) * (0.28 + 0.72 * ease.out3(clamp(sb / 0.42)))
      x.fillStyle = 'rgba(4,4,5,0.42)'
      x.beginPath(); x.ellipse(p.x, p.y, tws * 1.1, tws * 0.4, Math.atan2(-p.nx, p.ny), 0, 6.283); x.fill()
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
    const tw = o.fresh ? o.fresh.to : thick(o.wt[0], o.answered)
    // 줄기 안에서 번지는 농묵(뚜렷한 덩이가 아니라, 흐름을 따라 길게 풀린 짙은 먹)
    x.save()
    x.translate(p.x, p.y); x.rotate(Math.atan2(-p.nx, p.ny)); x.scale(1.9, 1)
    const pg = x.createRadialGradient(0, 0, 0, 0, 0, tw * 0.72)
    pg.addColorStop(0, 'rgba(2,2,3,0.95)'); pg.addColorStop(0.6, 'rgba(4,4,5,0.6)'); pg.addColorStop(1, 'rgba(4,4,5,0)')
    x.fillStyle = pg
    x.beginPath(); x.arc(0, 0, tw * 0.72, 0, 6.283); x.fill()
    x.restore()
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
    vchars(lb.s, lb.x, STR.lab, 30, FONT.serif, col, (ex ? 0.3 : 0.92) * a, 1.2, 0, 500)
    if (ex) vchars('판별제외', lb.x + 30, STR.lab - 8, 17, FONT.sans, '#3A352C', 0.6 * a, 1.15, 0, 500)
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

/** 족자 최종 좌표(화면) → 지금 렌즈가 있는 자리로 옮기는 변환: 표구가 렌즈와 함께 걸려 올라간다 */
function hangSpace(m: number) {
  if (m >= 1) return
  const s = lerp(1, PS, m), cy = lerp(LENS.y, FACE_Y, m)
  ctx.translate(LENS.x, cy); ctx.scale(s / PS, s / PS); ctx.translate(-LENS.x, -FACE_Y)
}
/** 족자 전체 */
function scrollFx(o: ScrollO) {
  ctx.save(); hangSpace(o.morph); mounting(o.mount, o.unroll); ctx.restore()
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
  mono('01', TICK.x - 12, y0 + 6, C.ash, 16, 'right', 0.65 * alpha * clamp(k * 3))
  mono('18', TICK.x - 12, y1 + 6, C.ash, 16, 'right', 0.65 * alpha * clamp(k * 3 - 2))
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
/** 패널 한 장 크기의 재사용 캔버스(전체 화면 레이어보다 싸다) */
let paneScratch: { c: HTMLCanvasElement; x: CanvasRenderingContext2D } | null = null
function paneLayer() {
  if (!paneScratch) {
    const c = document.createElement('canvas')
    c.width = PANE.w; c.height = PANE.h
    paneScratch = { c, x: c.getContext('2d')! }
  }
  return paneScratch
}
/**
 * 창호 패널 한 장(역광 한지). glow: 존재(0→1, 0.5 = 대기 상태의 등불, 1 = 선택되어 등불이 다 오름).
 * 어둠과 섞어 회색 카드가 되지 않도록, 등불을 낮출 때는 한지에 따뜻한 등빛을 곱해 채도를 지킨다.
 */
function paneFx(i: number, glow: number) {
  if (glow <= 0) return
  const y = paneY(i)
  const pres = clamp(glow / 0.5) // 나타남
  const lamp = clamp((glow - 0.5) / 0.5) // 등불이 오른 정도(0 = 대기, 1 = 선택)
  const P = paneLayer()
  const X = P.x
  X.globalCompositeOperation = 'source-over'
  X.globalAlpha = 1
  X.clearRect(0, 0, PANE.w, PANE.h)
  X.drawImage(paneCache(), PANE.x, y, PANE.w, PANE.h, 0, 0, PANE.w, PANE.h)
  // 등불: 글이 놓인 왼쪽 2/5 뒤에 핫스폿, 가장자리로 갈수록 호박빛으로 가라앉는다
  X.globalCompositeOperation = 'multiply'
  const g = X.createRadialGradient(PANE.w * 0.36, PANE.h * 0.5, 30, PANE.w * 0.42, PANE.h * 0.5, PANE.w * 0.7)
  const c0 = [lerp(196, 255, lamp), lerp(178, 252, lamp), lerp(150, 244, lamp)]
  const c1 = [lerp(118, 236, lamp), lerp(98, 214, lamp), lerp(76, 178, lamp)]
  g.addColorStop(0, `rgb(${c0.map(Math.round).join(',')})`)
  g.addColorStop(0.55, `rgb(${c0.map((v, j) => Math.round(lerp(v, c1[j], 0.45))).join(',')})`)
  g.addColorStop(1, `rgb(${c1.map(Math.round).join(',')})`)
  X.fillStyle = g; X.fillRect(0, 0, PANE.w, PANE.h)
  ctx.save()
  ctx.globalAlpha = ease.sine(pres)
  ctx.drawImage(P.c, PANE.x, y)
  ctx.restore()
}
/** 대기 중인 창들의 은은한 빛 번짐(어둠 속 등불감). k: 0→1 */
function paneGlowAll(ks: number[]) {
  if (ks.every((k) => k <= 0)) return
  const L = tmp()
  ks.forEach((k, i) => {
    if (k <= 0) return
    L.x.fillStyle = `rgba(255,206,140,${k})`
    L.x.fillRect(PANE.x + 30, paneY(i) + 10, PANE.w - 60, PANE.h - 20)
  })
  blurRegion(L.c, PANE.x, PANE.y0, PANE.w, paneY(3) + PANE.h - PANE.y0, 38, 0.2, 'screen')
}
/** 패널 위 먹 글씨: 번호(세로 계선으로 구획) + 답 */
function paneText(i: number, s: string, k: number, o: { alpha?: number; blur?: number } = {}) {
  const a = o.alpha ?? 1
  if (k <= 0 || a <= 0) return
  const y = paneY(i), cy = y + PANE.h / 2
  const b = o.blur ?? 0
  const e = ease.sine(clamp(k * 1.6))
  text(NUM[i], PANE.x + 54, cy + 11, `400 30px ${FONT.serif}`, '#2A1C10', { align: 'center', alpha: 0.7 * e * a, blur: b + (1 - e) * 6 })
  hair(PANE.x + 100, y + 30, PANE.x + 100, lerp(y + 30, y + PANE.h - 30, e), '#2A1C10', 1, 0.3 * a)
  inkLine(s, PANE.x + 134, cy + 13, `400 37px ${FONT.serif}`, '#120D08', clamp(k * 1.25 - 0.2), { spacing: 0.5, alpha: 0.95 * a, blur: b })
}

/** 손끝 그림자: 오른쪽 아래에서 다가와 접점으로 모인다. k 0(멀다)→1(닿음) */
function fingerShadow(tx: number, ty: number, k: number, alpha: number) {
  if (alpha <= 0) return
  const L = tmp()
  const off = 1 - k
  L.x.translate(tx + off * 90, ty + off * 130)
  L.x.rotate(Math.atan2(1, 0.45) - Math.PI / 2)
  // 손가락 끝만 또렷하고, 손 쪽으로 갈수록 그림자가 빛에 녹아 사라진다(막대처럼 읽히지 않게)
  const sg = L.x.createLinearGradient(0, 0, 0, 300)
  sg.addColorStop(0, 'rgba(46,32,20,1)'); sg.addColorStop(0.35, 'rgba(46,32,20,0.75)'); sg.addColorStop(1, 'rgba(46,32,20,0)')
  L.x.fillStyle = sg
  // 검지: 둥근 끝, 첫 마디에서 살짝 굵어진다
  const X = L.x
  X.beginPath()
  X.arc(0, 24, 24, Math.PI, 0)
  X.bezierCurveTo(26, 90, 30, 130, 30, 170)
  X.bezierCurveTo(33, 220, 40, 260, 48, 300)
  X.lineTo(-44, 300)
  X.bezierCurveTo(-36, 260, -30, 220, -28, 170)
  X.bezierCurveTo(-28, 130, -25, 90, -24, 24)
  X.closePath(); X.fill()
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 4; i++) ctx.rect(PANE.x, paneY(i), PANE.w, PANE.h)
  ctx.clip()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = alpha * (0.16 + 0.4 * k)
  ctx.filter = `blur(${4 + off * 30}px)`
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
    // 역광 속의 먹: 묽은 가장자리는 빛이 비쳐 갈색으로, 안쪽으로 갈수록 겹쳐 짙어진다
    const NL = 6
    for (let l = 0; l < NL; l++) {
      const u = l / (NL - 1)
      const phl = ph.map((p, j) => p + l * (0.7 + j * 0.31))
      x.fillStyle = `rgba(${Math.round(lerp(58, 6, u))},${Math.round(lerp(34, 7, u))},${Math.round(lerp(14, 8, u))},${lerp(0.2, 0.5, u)})`
      frontPath(x, ox, oy, R * lerp(1.12, 0.62, u), phl, 0.2 + 0.05 * u); x.fill()
    }
    // 번짐 전선의 짙은 테(먹이 마르며 가장자리에 모인다)
    x.strokeStyle = 'rgba(22,13,6,0.55)'; x.lineWidth = 2.4; frontPath(x, ox, oy, R * 1.12, ph, 0.2); x.stroke()
    x.strokeStyle = 'rgba(22,13,6,0.25)'; x.lineWidth = 6; frontPath(x, ox, oy, R * 1.1, ph, 0.2); x.stroke()
    // 입자감(먹 알갱이가 섬유에 걸린다)
    for (let j = 0; j < 260; j++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * R * 1.05
      const gx = ox + Math.cos(a) * d, gy = oy + Math.sin(a) * d * 0.62
      x.fillStyle = `rgba(${r() < 0.5 ? '4,4,5' : '70,44,20'},${0.15 + r() * 0.3})`
      x.fillRect(gx, gy, 1 + r() * 2.2, 1 + r() * 2.2)
    }
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
  note: '채록된 렌즈에서 계측선이 가운데로 거둬지고 수치가 흐려지면, 둥근 렌즈빛이 줄어들며 먹 초상이 위로 걸려 족자가 된다. 족자가 풀리며 네 갈래 먹줄기가 太陰·少陽·少陰(太陽은 판별 제외)으로 흘러내리고, 아래 어둠에는 앰버 표식이 01에서 07로 미끄러지며 질문이 맺히고 네 장의 한지 창에 차례로 등불이 든다.',
  dur: 3.5,
  render(t) {
    const T = T0.S10 + t
    const f = face(LENS.x, LENS.y, FACE_W)
    const morph = ease.inOut3(seg(t, 0.32, 1.45))
    const unroll = ease.inOut3(seg(t, 1.25, 1.98))
    const v = 1 + 6 * ease.inOut3(seg(t, 1.3, 2.3))
    const answered = v - 1
    const heads = [0, 1, 2, 3].map((i) => ease.out3(seg(t, 1.35 + i * 0.07, 2.12 + i * 0.07)))
    const upBlur = 2.2 * ease.sine(seg(t, 1.9, 2.8))
    const so: ScrollO = {
      T, morph, unroll, heads, answered, wt: WT7,
      paper: lerp(0.98, 0.64, morph),
      mount: ease.sine(seg(t, 0.5, 1.3)),
      beam: 0.8 * ease.sine(seg(t, 0.7, 1.9)),
    }
    // ── S09 잔광: 방의 빛과 렌즈 할로가 가라앉는다
    s09Room(1 - ease.sine(seg(t, 0, 1.0)))
    // ── 위: 족자 (초점이 문항으로 넘어가며 살짝 흐려진다)
    if (upBlur > 0.2) {
      const L = onLayer(() => scrollFx(so))
      blurRegion(L.c, 0, 0, W, 880, upBlur)
    } else scrollFx(so)
    // 렌즈 테·72눈금: 렌즈와 함께 올라가며 꺼진다
    const lensK = 1 - ease.sine(seg(t, 0.15, 0.75))
    if (lensK > 0) {
      ctx.save(); lensSpace(morph); s09Lens(lensK); ctx.restore()
    }
    // 계측 도해·판독값: 선은 가운데로 거둬지고 글자는 흐려진다
    s09Overlay(f, seg(t, 0, 0.62))

    // ── 아래: 문진
    ruler(v, seg(t, 0.9, 1.7))
    counter(v, ease.sine(seg(t, 1.0, 1.35)))
    questionHead(QS.q07, { rule: seg(t, 1.25, 2.0), tag: ease.sine(seg(t, 2.0, 2.4)), q: seg(t, 1.8, 2.6) })
    const pg = [0, 1, 2, 3].map((i) => seg(t, 1.95 + i * 0.12, 2.5 + i * 0.12))
    paneGlowAll(pg.map((k) => ease.sine(k)))
    for (let i = 0; i < 4; i++) {
      paneFx(i, 0.5 * pg[i])
      paneText(i, QS.q07.a[i], seg(t, 2.15 + i * 0.12, 2.85 + i * 0.12))
    }

    vignette(lerp(0.6, 0.55, seg(t, 0, 1)))
    // 머리띠: 형상 판독 04/04 → 문진
    header('墨光判讀室 · INK-LIGHT READING ROOM', '')
    mono('形象 · FACE READ  04 / 04', W - 72, 96, C.ash, 20, 'right', 1 - ease.sine(seg(t, 0.05, 0.35)))
    mono('問診 · SURVEY', W - 72, 96, C.ash, 20, 'right', ease.sine(seg(t, 0.35, 0.7)))
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
    const upBlur = 2.2 * (1 - ease.sine(seg(t, 0.95, 1.4))) + 2.2 * ease.sine(seg(t, 2.1, 2.7))
    const lowBlur = 3.2 * ease.sine(seg(t, 1.05, 1.45)) * (1 - ease.sine(seg(t, 1.95, 2.35)))
    // 太陰은 먹 덩이가 지나간 자리부터 굵어지고, 少陽·少陰은 그만큼 가늘어진다
    const tws = [0, thick(wt[1], answered), thick(wt[2], answered)]
    const fresh = { from: thick(WT7[0], 6), to: thick(WT8[0], 7) }
    const so: ScrollO = { T, morph: 1, unroll: 1, heads: [1, 1, 1, 1], answered, wt, pulse, fresh, tws, tauGlow, paper: 0.64, mount: 1, beam: 0.8 }

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
      paneGlowAll([old, ...floods.slice(1).map((k) => (1 - ease.sine(k)) * old)])
      paneHalo(0, lit * old)
      paneFx(0, g0)
      // 먹에 잠긴 창: 한지 결만 희미하게 남았다가 다음 문항이 올 때 걷힌다
      for (let i = 1; i < 4; i++) paneFx(i, lerp(0.5, 0.13, ease.sine(clamp((floods[i] - 0.2) / 0.8))) * old)
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
      paneGlowAll([0, 1, 2, 3].map((i) => ease.sine(seg(t, 2.45 + i * 0.1, 2.95 + i * 0.1))))
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
      mono('Q07 · ① → 太陰', 112, ly - 16, C.amber, 19, 'left', na)
      mono(`+${(WT8[0] - WT7[0]).toFixed(2).slice(1)}`, 112, ly + 38, C.amberCore, 24, 'left', na)
    }
    ctx.restore()

    vignette(0.55)
    header('墨光判讀室 · INK-LIGHT READING ROOM', '問診 · SURVEY')
    disclaimer(1)
  },
}

export const scenes: Scene[] = [S10, S11]
