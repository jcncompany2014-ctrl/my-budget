/**
 * 시안 스토리보드 공용 렌더 엔진 (Canvas 2D, 1080×1920)
 * 방향: 묵광 판독실 — B(한지 창·먹·낙관)를 뼈대로, A(빛기둥·스캔 평면·렌즈 판독), C(진주 입자·보케·물방울)를 섞는다.
 * 모든 장면은 render(t) 하나로 그려지며, 같은 t면 같은 그림이 나와야 한다(시드 고정).
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import demo from './data/neutralFace.json'

export const W = 1080
export const H = 1920

/** 팔레트 */
export const C = {
  void: '#050607', // 먹흑 배경
  ink: '#0B0D0F', // 먹
  inkSoft: '#15181A', // 연먹 (면, 비활성)
  hanji: '#F1E6CF', // 등불 한지광
  hanjiDeep: '#C9B590', // 한지 가장자리
  hanjiShadow: '#A89D88', // 한지 그림자(보조 텍스트)
  amber: '#E8A64B', // 소듐 앰버(A): 빛기둥, 스캔, 측정값
  amberCore: '#FFD08A',
  celadon: '#9CC3B2', // 청자 계측선
  celadonDeep: '#3F6A5E',
  cinnabar: '#C8341F', // 주사 낙관
  pearl: '#F3EEE5', // 진주(C)
  gold: '#D2B98A', // 샴페인 금 헤어라인(C)
  ash: '#8C877C',
}

/** 체질 석채색 */
export const TYPE_COL = { taeeum: '#4F8F6A', soyang: '#C46A3E', soeum: '#5873B0', taeyang: '#E2CB8A' } as const

export const FONT = {
  serif: '"Noto Serif KR", serif', // 한자·대제목 (200/400/900)
  hahmlet: '"Hahmlet", serif', // 한글 제목 (300/700)
  sans: '"Pretendard Variable", sans-serif', // 본문·버튼
  mono: '"IBM Plex Mono", monospace', // 수치 (300/400)
  italic: '"Cormorant Garamond", serif', // 이탤릭 숫자 (300 italic)
}

export let ctx: CanvasRenderingContext2D
export function setCtx(c: CanvasRenderingContext2D) { ctx = c }

/* ───────── 수학·이징 ───────── */
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
/** t가 [a,b] 구간에서 0→1 */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
export const ease = {
  sine: (k: number) => 0.5 - Math.cos(Math.PI * k) / 2,
  out3: (k: number) => 1 - (1 - k) ** 3,
  in2: (k: number) => k * k,
  expo: (k: number) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  p4out: (k: number) => 1 - (1 - k) ** 4,
  inOut3: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  ink: (k: number) => 1 - (1 - k) ** 2.4, // 확산형 감속
}
/** 시드 난수 */
export function rng(seed = 7) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/* ───────── 레이어·후처리 ───────── */
export function layer() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return { c, x: c.getContext('2d')! }
}
const pool: HTMLCanvasElement[] = []
/** 재사용 레이어(프레임마다 생성 비용 절감). 사용 후 release 필수 아님 — 프레임 시작 시 resetPool */
export function tmp() {
  const c = pool.pop() ?? document.createElement('canvas')
  c.width = W
  c.height = H
  used.push(c)
  return { c, x: c.getContext('2d')! }
}
const used: HTMLCanvasElement[] = []
export function resetPool() { while (used.length) pool.push(used.pop()!) }

/** 가산 블룸 */
export function bloom(src: HTMLCanvasElement, radii: number[], alpha: number[]) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  radii.forEach((r, i) => {
    ctx.filter = `blur(${r}px)`
    ctx.globalAlpha = alpha[i]
    ctx.drawImage(src, 0, 0)
  })
  ctx.restore()
}
/** 흐림 상태로 그리기(랙 포커스) */
export function drawBlur(src: HTMLCanvasElement, blur: number, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = op
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(src, 0, 0)
  ctx.restore()
}
let grainTex: ImageData | null = null
/** 필름 그레인 (고정 노이즈 텍스처를 프레임마다 오프셋) */
export function grain(amount = 12, frameSeed = 0) {
  if (!grainTex) {
    const r = rng(99)
    grainTex = new ImageData(512, 512)
    for (let i = 0; i < grainTex.data.length; i += 4) {
      const v = Math.floor(r() * 255)
      grainTex.data[i] = grainTex.data[i + 1] = grainTex.data[i + 2] = v
      grainTex.data[i + 3] = 255
    }
  }
  const g = document.createElement('canvas')
  g.width = 512
  g.height = 512
  g.getContext('2d')!.putImageData(grainTex, 0, 0)
  const ox = (frameSeed * 137) % 512
  const oy = (frameSeed * 311) % 512
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = amount / 100
  for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) ctx.drawImage(g, x, y)
  ctx.restore()
}
export function vignette(strength = 0.6) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}
/** 전체 암전 오버레이 (0=없음, 1=완전 검정) */
export function blackout(a: number) {
  if (a <= 0) return
  ctx.fillStyle = `rgba(5,6,7,${clamp(a)})`
  ctx.fillRect(0, 0, W, H)
}
export function clear(color = C.void) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
}

/* ───────── 타이포 ───────── */
export interface TextOpt { align?: CanvasTextAlign; spacing?: number; alpha?: number; blur?: number; baseline?: CanvasTextBaseline }
export function text(s: string, x: number, y: number, font: string, color: string, o: TextOpt = {}) {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = o.baseline ?? 'alphabetic'
  ctx.globalAlpha = o.alpha ?? 1
  if (o.spacing) ctx.letterSpacing = `${o.spacing}px`
  if (o.blur && o.blur > 0.2) ctx.filter = `blur(${o.blur}px)`
  ctx.fillText(s, x, y)
  ctx.restore()
}
/** 세로쓰기 */
export function vtext(s: string, x: number, y: number, size: number, font: string, color: string, gap = 1.15, o: TextOpt = {}) {
  ;[...s].forEach((ch, i) => text(ch, x, y + i * size * gap, `${size}px ${font}`, color, { ...o, align: 'center' }))
}
export function mono(s: string, x: number, y: number, color: string = C.ash, size = 22, align: CanvasTextAlign = 'left', alpha = 1) {
  text(s, x, y, `300 ${size}px ${FONT.mono}`, color, { align, spacing: size * 0.1, alpha })
}
export function hair(x0: number, y0: number, x1: number, y1: number, color: string, w = 1, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
}
/** 부분적으로 그려지는 선 (k: 0→1) */
export function drawLine(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w = 1) {
  if (k <= 0) return
  hair(x0, y0, lerp(x0, x1, k), lerp(y0, y1, k), color, w)
}

/* ───────── 얼굴 포인트 클라우드 ───────── */
export type Pt = { x: number; y: number; s: number; edge: number; r: number }
export interface Face { pts: Pt[]; lm: { x: number; y: number }[]; cx: number; cy: number; rx: number; ry: number; top: number; chin: number }

const faceCache = new Map<string, Face>()
/** 무표정 표준 얼굴(MediaPipe canonical, 입 다문 상태) 478점. cx,cy=중심, width=얼굴 폭(px) */
export function face(cx: number, cy: number, width: number, perEdge = 8, seed = 7): Face {
  const key = [cx, cy, width, perEdge, seed].join(',')
  const hit = faceCache.get(key)
  if (hit) return hit
  const r = rng(seed)
  const raw = demo.lm.map(([x, y]) => ({ x: x * demo.w, y: y * demo.h }))
  const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const sc = width / (maxX - minX)
  const ox = cx - ((minX + maxX) / 2) * sc
  const oy = cy - ((minY + maxY) / 2) * sc
  const lm = raw.map((p) => ({ x: 2 * cx - (p.x * sc + ox), y: p.y * sc + oy }))
  const rx = width / 2
  const ry = ((maxY - minY) * sc) / 2
  const shade = (x: number, y: number) => {
    const u = (x - cx) / rx, v = (y - cy) / ry
    return Math.sqrt(Math.max(0, 1 - u * u * 0.9 - v * v * 0.8))
  }
  const pts: Pt[] = []
  for (const e of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    const a = lm[e.start], b = lm[e.end]
    for (let i = 0; i < perEdge; i++) {
      const t = r()
      const x = a.x + (b.x - a.x) * t + (r() - 0.5) * 1.2
      const y = a.y + (b.y - a.y) * t + (r() - 0.5) * 1.2
      pts.push({ x, y, s: shade(x, y), edge: 0, r: r() })
    }
  }
  const contours = [
    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, FaceLandmarker.FACE_LANDMARKS_LIPS,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  ]
  for (const c of contours) for (const e of c) {
    const a = lm[e.start], b = lm[e.end]
    for (let i = 0; i < 20; i++) {
      const t = i / 20
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
      pts.push({ x, y, s: shade(x, y), edge: 1, r: r() })
    }
  }
  // 홍채·동공: 눈꺼풀 사이로만 보이는 원 (무표정 얼굴의 눈이 비어 보이지 않게). 마지막에 추가해 기존 점/난수 순서 유지
  for (const [c, ring, up, lo] of [[468, 469, 159, 145], [473, 474, 386, 374]]) {
    const o = lm[c], rad = Math.hypot(lm[ring].x - o.x, lm[ring].y - o.y)
    const top = lm[up].y + rad * 0.12, bot = lm[lo].y - rad * 0.05
    for (const [k, n] of [[1, 44], [0.42, 18]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283
        const x = o.x + Math.cos(a) * rad * k, y = o.y + Math.sin(a) * rad * k
        if (y < top || y > bot) continue
        pts.push({ x, y, s: shade(x, y), edge: 1, r: r() })
      }
    }
  }
  const f: Face = { pts, lm, cx, cy, rx, ry, top: lm[10].y, chin: lm[152].y }
  faceCache.set(key, f)
  return f
}

export type FaceStyle = 'amber' | 'ink' | 'pearl'
export interface FaceOpt {
  alpha?: number
  /** 스캔 평면 y: 위쪽은 밝게(판독 완료), 아래는 어둡게 */
  scanY?: number
  /** 체질 림 컬러(pearl) */
  rim?: string
  /** 보케 초점면 y (pearl) */
  focusY?: number
  /** 0→1: 입자가 흩어진 상태에서 얼굴로 모이는 정도 */
  gather?: number
  /** 흩어질 때의 기준점 (기본: 화면 아래 바닥) */
  from?: 'floor' | 'cloud' | 'drop'
  glow?: number
}
/** 얼굴 포인트 클라우드 렌더 (스타일별) */
export function drawFace(f: Face, style: FaceStyle, o: FaceOpt = {}) {
  const L = tmp()
  const B = tmp()
  const g = o.gather ?? 1
  const alpha = o.alpha ?? 1
  for (const p of f.pts) {
    let x = p.x, y = p.y
    if (g < 1) {
      // 입자별 지연을 둔 수렴
      const d = clamp((g - p.r * 0.45) / 0.55)
      const k = ease.ink(d)
      let sx: number, sy: number
      if (o.from === 'drop') { const a = p.r * 6.283 * 7; sx = f.cx + Math.cos(a) * (40 + p.r * 520); sy = f.cy + 260 + Math.sin(a) * 90 }
      else if (o.from === 'cloud') { const a = p.r * 6.283 * 13; sx = f.cx + Math.cos(a) * (300 + p.r * 500); sy = f.cy + Math.sin(a * 1.3) * (420 + p.r * 300) }
      else { sx = f.cx + (p.r - 0.5) * 900; sy = f.chin + 420 + p.r * 120 }
      x = lerp(sx, p.x, k)
      y = lerp(sy, p.y, k)
      if (d <= 0) continue
    }
    if (style === 'amber') {
      const near = o.scanY != null ? Math.exp(-((y - o.scanY) ** 2) / 900) : 0
      const lit = o.scanY != null && y > o.scanY ? 0.3 : 1
      const a = Math.min(1, 0.12 + p.s * 0.55 + near * 0.9 + p.edge * 0.25) * alpha
      L.x.fillStyle = near > 0.4 ? `rgba(255,236,200,${a})` : `rgba(232,166,75,${a * lit})`
      const s = 1.6 + p.edge * 0.6
      L.x.fillRect(x - s / 2, y - s / 2, s, s)
    } else if (style === 'ink') {
      const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5) * alpha
      L.x.fillStyle = `rgba(12,13,15,${a})`
      const r = p.edge ? 1.4 + p.r * 1.6 : 0.8 + p.r * 0.9
      L.x.beginPath(); L.x.arc(x, y, r, 0, 6.283); L.x.fill()
    } else {
      const rim = 1 - p.s
      const col = rim > 0.55 && o.rim ? hexA(o.rim, 1) : '243,238,229'
      const dz = o.focusY != null ? Math.abs(y - o.focusY) / 520 : 0
      const a = Math.min(1, 0.18 + p.s * 0.6 + p.edge * 0.2) * alpha
      if (dz > 0.42 && p.r < 0.06) {
        B.x.fillStyle = `rgba(${col},${0.05 + 0.05 * p.r * 10})`
        B.x.beginPath(); B.x.arc(x, y, 4 + dz * 16, 0, 6.283); B.x.fill()
      } else if (dz < 0.55 || p.r < 0.35) {
        L.x.fillStyle = `rgba(${col},${a * (1 - Math.min(0.7, dz))})`
        L.x.beginPath(); L.x.arc(x, y, 0.7 + p.r * 0.7, 0, 6.283); L.x.fill()
      }
    }
  }
  if (style === 'ink') {
    drawBlur(L.c, 5, 0.5) // 먹 번짐
    ctx.drawImage(L.c, 0, 0)
  } else {
    ctx.drawImage(B.c, 0, 0)
    ctx.drawImage(L.c, 0, 0)
    const gl = o.glow ?? 1
    if (gl > 0) bloom(L.c, style === 'amber' ? [3, 14, 40] : [2.5, 12, 34], (style === 'amber' ? [0.9, 0.55, 0.35] : [0.8, 0.45, 0.3]).map((v) => v * gl))
  }
}
/** '#RRGGBB' → 'r,g,b' (alpha 인자는 호환용) */
export function hexA(hex: string, _a = 1) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/* ───────── 장면 소품 ───────── */
let fiberCanvas: HTMLCanvasElement | null = null
function fibers() {
  if (fiberCanvas) return fiberCanvas
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!
  const r = rng(31)
  for (let i = 0; i < 7000; i++) {
    const px = r() * W, py = r() * H, a = r() * Math.PI, l = 8 + r() * 44
    x.strokeStyle = `rgba(${r() < 0.5 ? '255,250,235' : '150,130,95'},${0.08 + r() * 0.16})`
    x.lineWidth = 0.6 + r() * 0.8
    x.beginPath(); x.moveTo(px, py)
    x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l)
    x.stroke()
  }
  fiberCanvas = c
  return c
}
/** 역광 한지 면. glow 0→1 = 등불 밝기. 반환: 클립 영역 적용 콜백 */
export function hanji(x: number, y: number, w: number, h: number, glow = 1, opts: { halo?: boolean; tint?: string } = {}) {
  if (glow <= 0) return
  if (opts.halo !== false) {
    ctx.save(); ctx.filter = 'blur(90px)'; ctx.globalAlpha = 0.35 * glow
    ctx.fillStyle = C.hanji; ctx.fillRect(x - 40, y - 40, w + 80, h + 80); ctx.restore()
  }
  ctx.save()
  ctx.globalAlpha = glow
  const g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 60, x + w / 2, y + h * 0.5, Math.max(w, h) * 0.8)
  g.addColorStop(0, '#FBF2DE'); g.addColorStop(0.6, '#EBDCBF'); g.addColorStop(1, C.hanjiDeep)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  ctx.drawImage(fibers(), 0, 0)
  if (opts.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.18 * glow; ctx.fillStyle = opts.tint; ctx.fillRect(x, y, w, h) }
  ctx.restore()
}
/** 클립 영역 안에서 그리기 */
export function clipRect(x: number, y: number, w: number, h: number, fn: () => void) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore()
}
export function clipCircle(cx: number, cy: number, r: number, fn: () => void) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.clip(); fn(); ctx.restore()
}
/** 먹 번짐: 중심에서 퍼지는 담묵 덩어리. k 0→1 */
export function inkBloom(cx: number, cy: number, radius: number, k: number, seed = 3, alpha = 1) {
  if (k <= 0) return
  const r = rng(seed)
  const L = tmp()
  const n = 46
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * radius * ease.ink(k)
    const rr = (20 + r() * 90) * (0.4 + 0.6 * ease.ink(k))
    L.x.fillStyle = `rgba(10,12,14,${(0.05 + r() * 0.09) * alpha})`
    L.x.beginPath(); L.x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, rr, 0, 6.283); L.x.fill()
  }
  // 진한 중심
  L.x.fillStyle = `rgba(8,9,10,${0.5 * alpha * (1 - k * 0.6)})`
  L.x.beginPath(); L.x.arc(cx, cy, 14 + radius * 0.18 * ease.ink(k), 0, 6.283); L.x.fill()
  drawBlur(L.c, 10 + 18 * k)
}
/** 먹 방울 (낙하 중): y 위치, 크기 */
export function inkDrop(x: number, y: number, size = 16) {
  ctx.save()
  ctx.fillStyle = C.ink
  ctx.beginPath()
  ctx.moveTo(x, y - size * 1.6)
  ctx.bezierCurveTo(x + size, y - size * 0.4, x + size, y + size, x, y + size)
  ctx.bezierCurveTo(x - size, y + size, x - size, y - size * 0.4, x, y - size * 1.6)
  ctx.fill()
  ctx.restore()
}
/** 볼류메트릭 빛기둥(A). 위 폭 topW, 아래 폭 botW, 높이 h, intensity 0→1 */
export function beam(cx: number, topW: number, botW: number, h: number, intensity = 1, core: string = C.amberCore, edge: string = C.amber) {
  if (intensity <= 0) return
  const L = tmp()
  const g = L.x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, hexRgba(core, 0.55)); g.addColorStop(0.55, hexRgba(edge, 0.22)); g.addColorStop(1, hexRgba(edge, 0.05))
  L.x.fillStyle = g
  L.x.beginPath(); L.x.moveTo(cx - topW / 2, 0); L.x.lineTo(cx + topW / 2, 0); L.x.lineTo(cx + botW / 2, h); L.x.lineTo(cx - botW / 2, h); L.x.closePath(); L.x.fill()
  drawBlur(L.c, 60, 0.75 * intensity)
  ctx.save(); ctx.filter = 'blur(18px)'; ctx.globalAlpha = 0.25 * intensity; ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = hexRgba(core, 0.5); ctx.fillRect(cx - 14, 0, 28, h * 0.96); ctx.restore()
}
export function hexRgba(hex: string, a: number) { return `rgba(${hexA(hex)},${a})` }
/** 빛기둥 속 먼지. t(초)에 따라 천천히 떠다님 */
export function dust(cx: number, topW: number, botW: number, h: number, count: number, t: number, seed = 5, color = '255,214,150', alpha = 1) {
  const r = rng(seed)
  const L = tmp()
  for (let i = 0; i < count; i++) {
    const y0 = r() * h, sp = 4 + r() * 10, ph = r() * 6.283
    const y = (y0 - t * sp + h * 10) % h
    const half = (topW + (botW - topW) * (y / h)) / 2
    const x = cx + (r() * 2 - 1) * half * Math.sqrt(r()) + Math.sin(t * 0.4 + ph) * 6
    L.x.fillStyle = `rgba(${color},${(0.15 + r() * 0.55) * alpha})`
    L.x.beginPath(); L.x.arc(x, y, r() < 0.04 ? 2.4 : 0.9, 0, 6.283); L.x.fill()
  }
  ctx.drawImage(L.c, 0, 0)
  bloom(L.c, [4], [0.6])
}
/** 배경 보케(C) */
export function bokeh(count: number, t: number, seed = 11, tints = ['255,244,220', '143,188,165', '210,185,138'], alpha = 1) {
  const r = rng(seed)
  const L = tmp()
  for (let i = 0; i < count; i++) {
    const x = r() * W + Math.sin(t * 0.15 + i) * 14, y = r() * H * 0.85 + Math.cos(t * 0.12 + i) * 10, rr = 30 + r() * 110
    const tint = tints[i % tints.length]
    L.x.fillStyle = `rgba(${tint},${(0.04 + r() * 0.07) * alpha})`
    L.x.beginPath(); L.x.arc(x, y, rr, 0, 6.283); L.x.fill()
    L.x.strokeStyle = `rgba(${tint},${(0.05 + r() * 0.06) * alpha})`; L.x.lineWidth = 2; L.x.stroke()
  }
  drawBlur(L.c, 3)
}
/** 주사 낙관. chars: 2글자(세로). k: 0→1 찍히는 진행(눌림→떼기) */
export function seal(x: number, y: number, size: number, chars: string, k = 1, rot = -0.05, seed = 13) {
  if (k <= 0) return
  const press = k < 0.35 ? ease.out3(k / 0.35) : 1
  const s = size * (1.25 - 0.25 * press)
  const r = rng(seed)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = clamp(press * 1.1)
  ctx.fillStyle = C.cinnabar
  ctx.fillRect(-s / 2, -s / 2, s, s)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < size * 1.4; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.6})`; ctx.fillRect(-s / 2 + r() * s, -s / 2 + r() * s, 1 + r() * 3, 1 + r() * 3) }
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#F6E9D4'
  ctx.font = `900 ${s * 0.38}px ${FONT.serif}`
  ctx.textAlign = 'center'
  const cs = [...chars]
  if (cs.length >= 2) { ctx.fillText(cs[0], 0, -s * 0.04); ctx.fillText(cs[1], 0, s * 0.38) }
  else ctx.fillText(cs[0] ?? '', 0, s * 0.14)
  ctx.restore()
}
/** 틱 링: count개 눈금, progress만큼 활성 */
export function tickRing(cx: number, cy: number, r: number, count: number, progress: number, on: string, off: string, major = 6, len = 16) {
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2
    const L = i % major === 0 ? len : len * 0.5
    const act = i / count < progress
    hair(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + L), cy + Math.sin(a) * (r + L), act ? on : off, i % major === 0 ? 2 : 1.2)
  }
}
/** 코너 브래킷. k: 0=화면 밖, 1=목표 사각형에 수렴 */
export function brackets(x0: number, y0: number, x1: number, y1: number, k: number, color: string, L = 46, w = 2) {
  const e = ease.p4out(clamp(k))
  const bx0 = lerp(40, x0, e), by0 = lerp(160, y0, e), bx1 = lerp(W - 40, x1, e), by1 = lerp(H - 200, y1, e)
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w
  for (const [x, y, dx, dy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke()
  }
  ctx.restore()
}
/** 스캔 평면(A): 수평 레이저 + 위쪽 잔광 */
export function scanPlane(y: number, x0 = 70, x1 = W - 70, intensity = 1) {
  if (intensity <= 0) return
  const L = tmp()
  const g = L.x.createLinearGradient(0, y - 70, 0, y)
  g.addColorStop(0, 'rgba(255,208,138,0)'); g.addColorStop(1, 'rgba(255,208,138,0.28)')
  L.x.fillStyle = g; L.x.fillRect(x0 + 40, y - 70, x1 - x0 - 80, 70)
  L.x.fillStyle = 'rgba(255,240,210,1)'; L.x.fillRect(x0, y - 1, x1 - x0, 2)
  drawBlur(L.c, 0, intensity)
  bloom(L.c, [6, 24], [0.9 * intensity, 0.6 * intensity])
}
/** 물방울 렌즈(C) */
export function droplet(x: number, y: number, r: number, alpha = 1, inner?: () => void) {
  ctx.save(); ctx.globalAlpha = alpha
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 2, x, y, r)
  g.addColorStop(0, 'rgba(255,250,240,0.9)'); g.addColorStop(0.18, 'rgba(255,244,220,0.25)'); g.addColorStop(0.8, 'rgba(255,244,220,0.04)'); g.addColorStop(1, 'rgba(210,185,138,0.5)')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
  if (inner) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, 6.283); ctx.clip(); inner(); ctx.restore() }
  ctx.restore()
  const L = tmp(); L.x.fillStyle = 'rgba(255,244,220,0.9)'; L.x.beginPath(); L.x.arc(x - r * 0.36, y - r * 0.42, r * 0.12, 0, 6.283); L.x.fill()
  drawBlur(L.c, 0, alpha); bloom(L.c, [8, 30], [0.8 * alpha, 0.5 * alpha])
}
/** 파문(캐스틱 링) */
export function ripple(x: number, y: number, k: number, maxR = 300, color = '255,244,220') {
  if (k <= 0 || k >= 1) return
  for (let i = 0; i < 3; i++) {
    const kk = clamp(k - i * 0.12)
    if (kk <= 0) continue
    ctx.save(); ctx.strokeStyle = `rgba(${color},${0.5 * (1 - kk)})`; ctx.lineWidth = 2 - i * 0.5
    ctx.beginPath(); ctx.ellipse(x, y, maxR * ease.out3(kk), maxR * ease.out3(kk) * 0.28, 0, 0, 6.283); ctx.stroke(); ctx.restore()
  }
}
/** 한지 슬랩 버튼/카드 */
export function slab(x: number, y: number, w: number, h: number, opts: { active?: number; label?: string; sub?: string; glow?: number } = {}) {
  const a = opts.active ?? 0
  ctx.save()
  ctx.fillStyle = `rgba(21,24,26,${0.85})`
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = a > 0 ? hexRgba(C.hanji, 0.3 + 0.6 * a) : 'rgba(156,195,178,0.22)'
  ctx.lineWidth = 1 + a
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.fillStyle = a > 0 ? hexRgba(C.amber, 0.4 + 0.6 * a) : 'rgba(156,195,178,0.35)'
  ctx.fillRect(x, y, 5, h)
  if (a > 0) { ctx.globalAlpha = 0.12 * a; ctx.fillStyle = C.hanji; ctx.fillRect(x, y, w, h) }
  ctx.restore()
  if (opts.label) text(opts.label, x + 44, y + h / 2 + (opts.sub ? -2 : 13), `500 38px ${FONT.sans}`, a > 0 ? C.hanji : '#D8D0BE')
  if (opts.sub) text(opts.sub, x + 44, y + h / 2 + 40, `400 24px ${FONT.serif}`, C.hanjiShadow)
}
/** 상단 크레딧 바 (모든 장면 공통 헤더) */
export function header(left: string, right: string, alpha = 1) {
  mono(left, 72, 96, C.ash, 20, 'left', alpha)
  mono(right, W - 72, 96, C.ash, 20, 'right', alpha)
  hair(72, 118, W - 72, 118, 'rgba(140,135,124,0.3)', 1, alpha)
}
/** 하단 고지 띠 (항상 고정, 움직이지 않음) */
export function disclaimer(alpha = 1) {
  text('참고용 건강 정보이며 의학적 진단이 아닙니다 · 영상은 저장되지 않습니다', W / 2, H - 52, `400 22px ${FONT.sans}`, C.hanjiShadow, { align: 'center', alpha: 0.75 * alpha })
}

/* ───────── 장면 정의 ───────── */
export interface Scene {
  id: string // 'S01'
  act: string // '대기' 등
  title: string // 장면 제목(한국어)
  note: string // 연출 설명(한국어, 1~2문장)
  dur: number // 초
  render: (t: number) => void // t: 0..dur
}
