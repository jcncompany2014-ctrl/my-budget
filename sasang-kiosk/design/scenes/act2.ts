/**
 * 2막 입문 — S04 동의 날인, S05 신상 계측
 * 한지 창이 문서(광곽·계선·세로쓰기)가 되고, 주사 낙관이 찍히면 먹이 번져 암전.
 * 이어 어두운 무대에서 라인업 눈금자와 앰버 수평면이 키를 재고, BMI가 각인된 뒤 8엽 조리개가 닫힌다.
 */
import {
  C, FONT, H, W, blackout, bloom, clamp, clipRect, ctx, disclaimer, drawBlur, drawFace, drawLine, dust, ease, face,
  hair, hanji, header, inkBloom, layer, lerp, mono, rng, scanPlane, seal, seg, setCtx, text, tmp, vignette, type Scene,
} from '../engine'
import { WIN } from './act1'

/* ───────── 로컬 도우미 ───────── */

/** 엔진 함수를 오프스크린 레이어에 그린다 (ctx 교체) */
function offscreen(fn: () => void) {
  const L = tmp()
  const main = ctx
  setCtx(L.x)
  try { fn() } finally { setCtx(main) }
  return L.c
}

/** 알파를 존중하는 부분 선 (엔진 drawLine은 알파를 1로 덮어쓴다). k 0→1 */
function drawLineA(x0: number, y0: number, x1: number, y1: number, k: number, color: string, w: number, alpha: number) {
  if (k <= 0 || alpha <= 0) return
  hair(x0, y0, lerp(x0, x1, k), lerp(y0, y1, k), color, w, alpha)
}

/** 세로쓰기 한 줄 — 글자마다 위→아래로 먹이 맺히며(흐림→선명) 나타남. k 0→1 */
function vcol(s: string, x: number, y: number, size: number, font: string, color: string, k: number, gap = 1.18, maxBlur = 9) {
  const [wt, ...fam] = font.split(' ')
  const family = fam.join(' ')
  if (k <= 0) return
  const chars = [...s]
  const n = chars.length
  const st = 0.55
  let yy = y
  chars.forEach((ch, i) => {
    const step = ch === ' ' ? 0.45 : 1
    const kk = clamp((k - (i / n) * st) / (1 - st))
    if (ch !== ' ' && kk > 0) {
      text(ch, x, yy, `${wt} ${size}px ${family}`, color, { align: 'center', baseline: 'middle', alpha: ease.sine(kk), blur: (1 - ease.out3(kk)) * maxBlur })
    }
    yy += size * gap * step
  })
  return yy
}

/** 화면 터치 파문 (원형) */
function touchRings(x: number, y: number, k: number, maxR: number, rgb: string, op: GlobalCompositeOperation = 'source-over', a = 0.6) {
  if (k <= 0 || k >= 1) return
  ctx.save()
  ctx.globalCompositeOperation = op
  for (let i = 0; i < 3; i++) {
    const kk = clamp((k - i * 0.14) / 0.72)
    if (kk <= 0 || kk >= 1) continue
    ctx.strokeStyle = `rgba(${rgb},${a * (1 - kk)})`
    ctx.lineWidth = 2.2 - i * 0.6
    ctx.beginPath(); ctx.arc(x, y, maxR * ease.out3(kk), 0, 6.283); ctx.stroke()
  }
  ctx.restore()
}

/** 사각 둘레를 k만큼 그리는 경로 (좌상단부터 시계방향) */
function perimeter(x: number, y: number, w: number, h: number, k: number) {
  const P = 2 * (w + h)
  let left = P * clamp(k)
  const pts: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
  ctx.beginPath(); ctx.moveTo(x, y)
  for (let i = 0; i < 4 && left > 0; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const len = Math.hypot(bx - ax, by - ay)
    const f = Math.min(1, left / len)
    ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f)
    left -= len
  }
}

/** 손끝 그림자: 역광 한지 위로 손가락이 다가오며 그림자가 접점으로 모인다. k 0(멀다)→1(닿음) */
function fingerShadow(tx: number, ty: number, k: number, alpha: number) {
  if (alpha <= 0) return
  const L = tmp()
  const off = 1 - k
  const phi = Math.atan2(1, 0.5) // 손가락은 오른쪽 아래에서 들어온다
  L.x.translate(tx + off * 80, ty + off * 120)
  L.x.rotate(phi - Math.PI / 2)
  L.x.fillStyle = 'rgb(46,32,20)'
  L.x.beginPath(); L.x.arc(0, 30, 30, Math.PI, 0); L.x.lineTo(44, 400); L.x.lineTo(-44, 400); L.x.closePath(); L.x.fill()
  L.x.beginPath(); L.x.ellipse(36, 590, 150, 200, 0.22, 0, 6.283); L.x.fill()
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = alpha * (0.16 + 0.34 * k)
  ctx.filter = `blur(${5 + off * 38}px)`
  ctx.drawImage(L.c, 0, 0)
  ctx.restore()
}

/** 각도 a에서의 번짐 전선 반경 계수 (여러 주파수의 사인 합 = 종이 섬유를 따라 고르지 않게 번진다) */
function frontR(a: number, ph: number[], amp: number) {
  return 1 + amp * (0.5 * Math.sin(3 * a + ph[0]) + 0.32 * Math.sin(7 * a + ph[1]) + 0.2 * Math.sin(13 * a + ph[2]) + 0.1 * Math.sin(23 * a + ph[3]) + 0.035 * Math.sin(47 * a + ph[4]))
}
function frontPath(x: CanvasRenderingContext2D, cx: number, cy: number, R: number, ph: number[], amp: number) {
  x.beginPath()
  for (let i = 0; i <= 260; i++) {
    const a = (i / 260) * Math.PI * 2
    const rr = R * frontR(a, ph, amp)
    if (i === 0) x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    else x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  x.closePath()
}
/** 먹 와이프: 한 점에서 번져 화면을 삼킨다 (담묵 가장자리 → 농묵 중심, 마른 자국 테두리). k 0→1 */
function inkWash(cx: number, cy: number, k: number, seed = 41) {
  if (k <= 0) return
  const r = rng(seed)
  const e = ease.inOut3(k)
  const R = 40 + 1720 * e
  const ph = Array.from({ length: 5 }, () => r() * 6.283 + k * 0.5)
  const ph2 = Array.from({ length: 5 }, () => r() * 6.283 - k * 0.4)
  const ph3 = Array.from({ length: 5 }, () => r() * 6.283 + k * 0.3)
  const L = tmp()
  const x = L.x
  // 담묵 전선
  x.fillStyle = 'rgba(8,9,10,0.55)'; frontPath(x, cx, cy, R, ph, 0.2); x.fill()
  // 마른 자국(가장자리에 먹이 몰림)
  x.strokeStyle = 'rgba(6,7,8,0.55)'; x.lineWidth = 3 + 4 * e; frontPath(x, cx, cy, R * 0.995, ph, 0.2); x.stroke()
  // 중묵·농묵
  x.fillStyle = 'rgba(7,8,9,0.7)'; frontPath(x, cx, cy, R * 0.84, ph2, 0.24); x.fill()
  x.fillStyle = 'rgba(5,6,7,0.95)'; frontPath(x, cx, cy, R * 0.62, ph3, 0.28); x.fill()
  // 섬유를 타고 뻗는 실번짐
  x.lineCap = 'round'
  for (let i = 0; i < 140; i++) {
    const a = r() * 6.283
    const d0 = R * frontR(a, ph, 0.2) * (0.97 + r() * 0.02)
    const len = (12 + r() * 70) * (0.3 + e)
    const tw = (r() - 0.5) * 0.9
    x.strokeStyle = `rgba(6,7,8,${0.25 + r() * 0.35})`
    x.lineWidth = 0.8 + r() * 2.4
    const ax = cx + Math.cos(a) * d0, ay = cy + Math.sin(a) * d0
    x.beginPath(); x.moveTo(ax, ay)
    x.lineTo(ax + Math.cos(a + tw) * len, ay + Math.sin(a + tw) * len)
    x.stroke()
  }
  // 젖은 한지는 번짐 앞에서 잠깐 더 투명해진다(밝은 띠)
  ctx.save()
  ctx.beginPath(); ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h); ctx.clip()
  ctx.globalCompositeOperation = 'lighter'
  ctx.filter = 'blur(22px)'
  ctx.globalAlpha = 0.2 * (1 - k)
  ctx.strokeStyle = '#FFF3DA'
  ctx.lineWidth = 50
  frontPath(ctx, cx, cy, R * 1.04, ph, 0.2); ctx.stroke()
  ctx.restore()
  drawBlur(L.c, 5, 0.9)
  drawBlur(L.c, 26, 0.6)
}

/* ───────── 1막에서 이어지는 무대 (S03 마지막 프레임과 같은 빛) ───────── */
/** act1과 같은 빛기둥 원뿔·얼굴·캡션 기준 */
const BM = { cx: W / 2, topW: 120, botW: 800, h: 1420 }
const beamHalf = (y: number) => (BM.topW + (BM.botW - BM.topW) * clamp(y / BM.h)) / 2
const CAP = { kicker: 1488, title: 1592, ring: 1700, call: 1782 }
/** S03 종료 시각(전역) — 먼지·맥동 위상을 이어받는다 */
const T_S04 = 15
let beamC: HTMLCanvasElement | null = null
function beamCache() {
  if (beamC) return beamC
  const P = layer(), S = layer()
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
  P.x.filter = 'none'
  const g = P.x.createRadialGradient(BM.cx, -30, 0, BM.cx, -30, 260)
  g.addColorStop(0, 'rgba(255,226,170,0.55)'); g.addColorStop(0.4, 'rgba(255,200,120,0.16)'); g.addColorStop(1, 'rgba(255,200,120,0)')
  P.x.fillStyle = g; P.x.fillRect(0, 0, W, 320)
  beamC = P.c
  return beamC
}
let winC: HTMLCanvasElement | null = null
/** 한지 창 + 빛기둥이 떨어진 자리(위가 밝고 따뜻, 원뿔 밖은 그늘) */
function winCache() {
  if (winC) return winC
  const P = layer()
  const main = ctx
  setCtx(P.x); hanji(WIN.x, WIN.y, WIN.w, WIN.h, 1); setCtx(main)
  const S = layer()
  S.x.fillStyle = 'rgba(70,52,30,0.5)'; S.x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h)
  S.x.globalCompositeOperation = 'destination-out'; S.x.filter = 'blur(40px)'; S.x.fillStyle = '#000'
  S.x.beginPath()
  S.x.moveTo(BM.cx - beamHalf(0) * 1.1, 0); S.x.lineTo(BM.cx + beamHalf(0) * 1.1, 0)
  S.x.lineTo(BM.cx + beamHalf(BM.h) * 1.1, BM.h); S.x.lineTo(BM.cx - beamHalf(BM.h) * 1.1, BM.h)
  S.x.closePath(); S.x.fill()
  const vg = S.x.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h)
  S.x.filter = 'none'; S.x.globalCompositeOperation = 'destination-in'
  vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.55, 'rgba(0,0,0,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0.15)')
  S.x.fillStyle = vg; S.x.fillRect(0, 0, W, H)
  P.x.save()
  P.x.beginPath(); P.x.rect(WIN.x, WIN.y, WIN.w, WIN.h); P.x.clip()
  P.x.globalCompositeOperation = 'multiply'; P.x.drawImage(S.c, 0, 0)
  P.x.globalCompositeOperation = 'screen'
  const hg = P.x.createRadialGradient(BM.cx, WIN.y - 60, 0, BM.cx, WIN.y - 60, 560)
  hg.addColorStop(0, 'rgba(255,214,150,0.55)'); hg.addColorStop(0.5, 'rgba(240,180,100,0.16)'); hg.addColorStop(1, 'rgba(240,180,100,0)')
  P.x.fillStyle = hg; P.x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h)
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
function strikeCache() {
  if (lineC) return lineC
  const P = layer(), S = layer()
  const g = S.x.createLinearGradient(WIN.x, 0, WIN.x + WIN.w, 0)
  g.addColorStop(0, 'rgba(255,214,150,0.05)'); g.addColorStop(0.32, 'rgba(255,220,160,0.6)'); g.addColorStop(0.5, 'rgba(255,240,210,1)')
  g.addColorStop(0.68, 'rgba(255,220,160,0.6)'); g.addColorStop(1, 'rgba(255,214,150,0.05)')
  S.x.fillStyle = g; S.x.fillRect(WIN.x, WIN.y - 1.5, WIN.w, 3)
  P.x.globalCompositeOperation = 'lighter'
  for (const [b, a] of [[22, 0.7], [6, 0.9], [0, 1]] as const) { P.x.filter = b ? `blur(${b}px)` : 'none'; P.x.globalAlpha = a; P.x.drawImage(S.c, 0, 0) }
  lineC = P.c
  return lineC
}
function stage(lamp: number, T: number) {
  drawBlur(winCache(), 0, 0.92 * lamp)
  return {
    beam() {
      drawBlur(beamCache(), 0, lamp, 'screen')
      ctx.save(); ctx.globalAlpha = 0.45 * lamp; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(strikeCache(), 0, 0); ctx.restore()
      dust(BM.cx, BM.topW * 0.9, BM.topW + (BM.botW - BM.topW) * 0.95 * 0.9, BM.h * 0.95, Math.round(760 * 0.95 + 80), T, 5, '255,214,150', lamp)
    },
  }
}
/** S03 오른쪽 여백의 사상 색인(세로쓰기) — 이어받아 사라진다 */
function archIndex(alpha: number) {
  if (alpha <= 0) return
  const labels = ['太陰', '少陽', '少陰', '太陽']
  labels.forEach((s, i) => {
    const base = i === 3 ? 0.22 : 0.42
    ;[...s].forEach((ch, j) => text(ch, 1005, 548 + i * 118 + j * 30 * 1.18, `400 30px ${FONT.serif}`, C.hanjiShadow, { align: 'center', alpha: base * alpha }))
  })
  hair(1005, 520, 1005, 534, C.celadon, 1, 0.4 * alpha)
  mono('形', 1005, 506, C.celadon, 15, 'center', 0.6 * alpha)
  mono('—', 1005, 548 + 3 * 118 + 96, C.hanjiShadow, 15, 'center', 0.35 * alpha)
}

/* ───────── S04 동의 ───────── */

/** 문서 광곽(匡郭) */
const DOC = { x0: 198, x1: 882, y0: 248, y1: 1332 }
const COL = { title: 822, b: 702, c: 590, d: 478, seal: 310 }
const RULES = [762, 646, 534, 422]
const SEAL = { x: 310, y: 1150, box: 172, size: 150 }
const INK = '#17191B'
const LINE = '#3F6A5E'
const T = { touch0: 0.12, dissolve: [0.22, 1.35], frame: [0.55, 1.35], rules: [0.85, 1.5], title: [0.95, 1.5], lines: [1.1, 1.35, 1.6], box: [1.75, 2.15], finger: [2.05, 2.5], stamp: 2.5, wipe: [3.3, 4.32] }

const S04: Scene = {
  id: 'S04',
  act: '입문',
  title: '동의의 날인',
  note: '먹 얼굴이 한지에 스며 사라지고, 같은 먹이 세로쓰기 동의문으로 맺힌다. 손끝 그림자가 빈 인장 자리에 닿는 순간 주사 낙관이 찍히고, 낙관에서 먹이 번져 화면을 삼킨다.',
  dur: 4.5,
  render(t) {
    const kWipe = seg(t, T.wipe[0], T.wipe[1])
    const lamp = 1 - 0.75 * ease.sine(seg(t, 3.45, 4.3))
    // 날인 순간의 미세한 카메라 펀치(바운스 없음: 한 번 밀고 돌아옴)
    const pk = seg(t, T.stamp + 0.05, T.stamp + 0.4)
    const punch = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) * (1 - pk) * 0.016 : 0
    ctx.save()
    if (punch) { ctx.translate(SEAL.x, SEAL.y); ctx.scale(1 + punch, 1 + punch); ctx.translate(-SEAL.x, -SEAL.y) }

    // 무대: 한지 창 (S03에서 이어짐). 빛기둥은 문서 위에 스크린으로 얹는다
    const st = stage(lamp, T_S04 + t)

    // ① 먹 얼굴이 종이에 스며 풀린다
    const kF = seg(t, T.dissolve[0], T.dissolve[1])
    if (kF < 1) {
      const F = offscreen(() => drawFace(face(540, 760, 500), 'ink'))
      const e = ease.ink(kF)
      clipRect(WIN.x, WIN.y, WIN.w, WIN.h, () => {
        ctx.save()
        ctx.globalAlpha = 1 - ease.sine(kF)
        if (e > 0.01) ctx.filter = `blur(${e * 16}px)`
        ctx.translate(540, 760); ctx.scale(1 + e * 0.07, 1 + e * 0.05); ctx.translate(-540, -760)
        ctx.drawImage(F, 0, 0)
        ctx.restore()
        inkBloom(540, 760, 380, e, 3, Math.sin(kF * Math.PI) * 0.45)
      })
    }

    // ② 광곽·계선: 빛이 선을 긋는다
    const kFr = ease.inOut3(seg(t, T.frame[0], T.frame[1]))
    if (kFr > 0) {
      ctx.save()
      ctx.strokeStyle = LINE; ctx.globalAlpha = 0.75 * lamp; ctx.lineWidth = 2.2
      perimeter(DOC.x0, DOC.y0, DOC.x1 - DOC.x0, DOC.y1 - DOC.y0, kFr); ctx.stroke()
      ctx.globalAlpha = 0.45 * lamp; ctx.lineWidth = 1
      perimeter(DOC.x0 + 9, DOC.y0 + 9, DOC.x1 - DOC.x0 - 18, DOC.y1 - DOC.y0 - 18, kFr); ctx.stroke()
      ctx.restore()
    }
    RULES.forEach((x, i) => {
      const k = ease.out3(seg(t, T.rules[0] + i * 0.08, T.rules[0] + 0.45 + i * 0.08))
      const yEnd = x === 422 ? 1020 : DOC.y1 - 9
      drawLineA(x, DOC.y0 + 9, x, yEnd, k, LINE, 1, 0.5 * lamp)
    })

    // ③ 세로쓰기 동의문 (우→좌)
    vcol('同意書', COL.title, 430, 92, `200 ${FONT.serif}`, INK, seg(t, T.title[0], T.title[1] + 0.3), 1.16)
    vcol('동의서', COL.title, 820, 26, `300 ${FONT.hahmlet}`, '#6B5E49', seg(t, T.title[0] + 0.3, T.title[1] + 0.5), 1.3, 4)
    const lines = ['안면 촬영·분석 동의', '영상은 저장되지 않음', '참고용 건강 정보']
    const xs = [COL.b, COL.c, COL.d]
    lines.forEach((s, i) => {
      const k = seg(t, T.lines[i], T.lines[i] + 0.75)
      if (k <= 0) return
      mono(`0${i + 1}`, xs[i], 360, LINE, 20, 'center', ease.sine(seg(t, T.lines[i], T.lines[i] + 0.3)) * 0.9)
      hair(xs[i] - 14, 376, xs[i] + 14, 376, LINE, 1, ease.sine(k) * 0.6)
      vcol(s, xs[i], 430, 56, `300 ${FONT.hahmlet}`, INK, k, 1.2)
    })

    // ④ 빈 인장 자리 + 안내 세로쓰기
    const kLab = seg(t, 1.6, 2.2)
    vcol('날인하여 동의', COL.seal, 430, 44, `300 ${FONT.hahmlet}`, '#8E2A1A', kLab, 1.22, 6)
    const kGuide = ease.out3(seg(t, 1.95, 2.35))
    if (kGuide > 0) {
      ctx.save(); ctx.setLineDash([2, 7])
      drawLineA(COL.seal, 790, COL.seal, SEAL.y - SEAL.box / 2 - 16, kGuide, '#8E2A1A', 1.4, 0.6 * lamp)
      ctx.restore()
    }
    const kBox = ease.inOut3(seg(t, T.box[0], T.box[1]))
    const stamped = seg(t, T.stamp, T.stamp + 0.2)
    if (kBox > 0) {
      const b = SEAL.box
      const breathe = 0.6 + 0.25 * Math.sin(t * 5.2)
      ctx.save()
      ctx.globalAlpha = (1 - 0.8 * stamped) * breathe * lamp
      ctx.fillStyle = 'rgba(200,52,31,0.05)'
      ctx.fillRect(SEAL.x - b / 2, SEAL.y - b / 2, b, b)
      ctx.strokeStyle = C.cinnabar; ctx.lineWidth = 2; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 18
      perimeter(SEAL.x - b / 2, SEAL.y - b / 2, b, b, kBox); ctx.stroke()
      ctx.restore()
      // 모서리 맞춤표(청자)
      const m = b / 2 + 14
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const cx = SEAL.x + sx * m, cy = SEAL.y + sy * m
        hair(cx, cy, cx - sx * 14 * kBox, cy, LINE, 1.2, 0.7 * lamp)
        hair(cx, cy, cx, cy - sy * 14 * kBox, LINE, 1.2, 0.7 * lamp)
      }
    }

    // ⑤ 손끝 → 파문 → 낙관
    const kFin = ease.inOut3(seg(t, T.finger[0], T.finger[1]))
    const finOut = ease.sine(seg(t, T.stamp + 0.25, T.stamp + 0.7))
    fingerShadow(SEAL.x + 6, SEAL.y + 4, kFin * (1 - finOut), seg(t, T.finger[0] - 0.05, T.finger[0] + 0.2) * (1 - finOut) * lamp)
    const kRip = seg(t, T.stamp - 0.04, T.stamp + 0.9)
    touchRings(SEAL.x, SEAL.y, kRip, 230, '120,70,40', 'multiply', 0.55)
    const kSeal = seg(t, T.stamp, T.stamp + 0.55)
    if (kSeal > 0 && kWipe < 0.35) {
      // 주사가 섬유로 스민다
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.filter = 'blur(14px)'
      ctx.globalAlpha = 0.28 * ease.out3(seg(t, T.stamp + 0.08, T.stamp + 0.9))
      ctx.fillStyle = C.cinnabar; ctx.fillRect(SEAL.x - 90, SEAL.y - 90, 180, 180); ctx.restore()
      seal(SEAL.x, SEAL.y, SEAL.size, '同意', kSeal, -0.04)
    }
    const kStampTxt = seg(t, T.stamp + 0.35, T.stamp + 0.75)
    if (kStampTxt > 0) {
      mono('同意 · 確認', SEAL.x, 1294, '#5B3A2A', 17, 'center', 0.75 * kStampTxt * lamp)
    }

    // 문서 바깥 여백 각주
    const kFoot = ease.sine(seg(t, 1.3, 1.9)) * lamp
    mono('No.0412 · 影像保存 0s', DOC.x0, 1364, '#5E5444', 16, 'left', 0.7 * kFoot)
    mono('觀形 · 入門 01', DOC.x1, 1364, '#5E5444', 16, 'right', 0.7 * kFoot)

    st.beam()
    archIndex(1 - ease.sine(seg(t, 0.1, 0.55)))
    vignette(0.7)

    // 창 아래: S03 캡션(키커·제목·맥동 링) → 터치 → 안내
    const kOld = 1 - ease.sine(seg(t, 0.18, 0.7))
    if (kOld > 0) {
      text('四象 形象 分析', W / 2, CAP.kicker, `200 40px ${FONT.serif}`, C.hanji, { align: 'center', spacing: 22, alpha: kOld * 0.78 })
      text('얼굴과 몸으로 읽는 체질', W / 2, CAP.title, `300 60px ${FONT.hahmlet}`, C.hanji, { align: 'center', spacing: 3, alpha: kOld, blur: (1 - kOld) * 6 })
      const ph = (T_S04 + t - 12.5) / 2.4
      const breath = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2)
      const rp = ph - Math.floor(ph)
      ctx.save()
      ctx.strokeStyle = `rgba(241,230,207,${0.5 * (1 - rp) * kOld})`; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(W / 2, CAP.ring, 8 + 30 * ease.out3(rp), 0, 6.283); ctx.stroke()
      ctx.fillStyle = `rgba(241,230,207,${(0.55 + 0.4 * breath) * kOld})`
      ctx.beginPath(); ctx.arc(W / 2, CAP.ring, 4.5, 0, 6.283); ctx.fill()
      ctx.restore()
      text('화면을 터치하세요', W / 2, CAP.call, `400 30px ${FONT.sans}`, C.hanji, { align: 'center', spacing: 10, alpha: (0.45 + 0.5 * breath) * kOld })
    }
    // 관람자의 터치: 맥동 링 자리에서 빛 파문
    const kT = seg(t, T.touch0, T.touch0 + 0.8)
    touchRings(W / 2, CAP.ring, kT, 200, '255,226,180', 'lighter', 0.7)
    if (kT > 0 && kT < 1) {
      const D = offscreen(() => { ctx.fillStyle = 'rgba(255,226,180,1)'; ctx.beginPath(); ctx.arc(W / 2, CAP.ring, 7, 0, 6.283); ctx.fill() })
      bloom(D, [6, 26], [(1 - kT) * 0.9, (1 - kT) * 0.6])
    }
    const kIns = ease.sine(seg(t, 1.35, 1.85)) * (1 - ease.sine(seg(t, T.stamp + 0.1, T.stamp + 0.4)))
    if (kIns > 0) {
      text('入門 · 同意', W / 2, CAP.kicker, `200 36px ${FONT.serif}`, C.hanji, { align: 'center', spacing: 18, alpha: kIns * 0.7 })
      text('낙관을 눌러 동의해 주세요', W / 2, CAP.title, `300 52px ${FONT.hahmlet}`, C.hanji, { align: 'center', spacing: 3, alpha: kIns, blur: (1 - kIns) * 6 })
    }
    const kDone = ease.sine(seg(t, T.stamp + 0.35, T.stamp + 0.75)) * (1 - ease.sine(kWipe * 1.6 > 1 ? 1 : kWipe * 1.6))
    if (kDone > 0) {
      mono('SEALED · 同意 確認 · 14:32:07', W / 2, CAP.kicker - 6, C.amber, 20, 'center', kDone * 0.9)
      text('동의가 날인되었습니다', W / 2, CAP.title, `300 52px ${FONT.hahmlet}`, C.hanji, { align: 'center', spacing: 3, alpha: kDone, blur: (1 - kDone) * 6 })
    }

    // 헤더: 오른쪽 상태만 STANDBY → CONSENT로 바뀐다
    mono('墨光判讀室 · INK-LIGHT READING ROOM', 72, 96, C.ash, 20, 'left')
    hair(72, 118, W - 72, 118, 'rgba(140,135,124,0.3)', 1)
    mono('STANDBY', W - 72, 96, C.ash, 20, 'right', 1 - ease.sine(seg(t, 0.2, 0.55)))
    mono('入門 · CONSENT', W - 72, 96, C.ash, 20, 'right', ease.sine(seg(t, 0.5, 0.9)))
    disclaimer(ease.sine(seg(t, 0.4, 1.1)))

    // ⑥ 먹 와이프: 낙관에서 번진 먹이 전부를 덮는다. 낙관만 마지막까지 남는다
    if (kWipe > 0) {
      inkWash(SEAL.x, SEAL.y, kWipe)
      const keep = 1 - ease.sine(seg(t, 3.85, 4.4))
      if (keep > 0) {
        const S = offscreen(() => seal(SEAL.x, SEAL.y, SEAL.size, '同意', 1, -0.04))
        drawBlur(S, 0, keep)
        bloom(S, [10, 40], [0.35 * keep, 0.25 * keep])
      }
    }
    ctx.restore()
    blackout(ease.sine(seg(t, 4.25, 4.5)))
  },
}

/* ───────── S05 신상 ───────── */

const yCm = (cm: number) => 1620 - (cm - 140) * 21.5
const SL = { x: 430, w: 580, h: 196, gap: 36 }
const slabTop = (i: number) => yCm(173) - SL.h / 2 + (i - 2) * (SL.h + SL.gap)
const ROWS = [
  { hz: '性別', ko: '성별', unit: '', raw: 'SEX · M', win: [0.42, 0.72] },
  { hz: '年齡', ko: '나이', unit: '세', raw: 'AGE · 35', win: [0.7, 1.0] },
  { hz: '身長', ko: '키', unit: 'cm', raw: 'H · 173.0', win: [0.98, 1.95] },
  { hz: '體重', ko: '몸무게', unit: 'kg', raw: 'W · 61.0', win: [1.92, 2.3] },
] as const
const TH = { mark: [1.0, 1.9] as const, bmi: 2.25, iris: [3.3, 3.96] as const }
/** 초점이 머무는 석판 번호(0~3), 4 = BMI. 랙 포커스로 옮겨 다닌다 */
function focusAt(t: number) {
  const steps: [number, number][] = [[0.66, 0.78], [0.94, 1.06], [1.86, 1.98], [2.22, 2.4]]
  let f = 0
  steps.forEach(([a, b]) => { f += ease.inOut3(seg(t, a, b)) })
  return f
}
let inkBgC: HTMLCanvasElement | null = null
/** 먹이 스민 어둠: S04 와이프의 먹이 아직 마르지 않은 듯한 아주 옅은 농담 */
function inkBg() {
  if (inkBgC) return inkBgC
  const P = layer()
  const r = rng(303)
  P.x.filter = 'blur(70px)'
  for (let i = 0; i < 26; i++) {
    const light = r() < 0.55
    P.x.fillStyle = light ? `rgba(28,29,30,${0.2 + r() * 0.3})` : `rgba(0,0,0,${0.4 + r() * 0.4})`
    P.x.beginPath(); P.x.ellipse(r() * W, r() * H, 120 + r() * 320, 90 + r() * 260, r() * 3, 0, 6.283); P.x.fill()
  }
  inkBgC = P.c
  return inkBgC
}
let stoneC: HTMLCanvasElement | null = null
/** 먹돌 결(안료 알갱이·희미한 결) 패턴 타일 */
function stone() {
  if (stoneC) return stoneC
  const c = document.createElement('canvas')
  c.width = 384; c.height = 384
  const x = c.getContext('2d')!
  const r = rng(77)
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = r() < 0.5 ? `rgba(241,230,207,${0.02 + r() * 0.05})` : `rgba(0,0,0,${0.1 + r() * 0.2})`
    x.fillRect(r() * 384, r() * 384, 1 + r() * 1.5, 1 + r() * 1.5)
  }
  for (let i = 0; i < 9; i++) {
    x.strokeStyle = `rgba(210,185,138,${0.02 + r() * 0.03})`; x.lineWidth = 0.6 + r()
    const y0 = r() * 384
    x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(128, y0 + (r() - 0.5) * 60, 256, y0 + (r() - 0.5) * 60, 384, y0 + (r() - 0.5) * 30); x.stroke()
  }
  stoneC = c
  return c
}

function ruler(t: number) {
  const bmiIn = ease.sine(seg(t, TH.bmi - 0.1, TH.bmi + 0.4))
  // 척추선 (아래→위)
  drawLine(150, yCm(140) + 26, 150, yCm(200) - 26, ease.out3(seg(t, 0, 0.75)), 'rgba(156,195,178,0.5)', 1)
  for (let cm = 140; cm <= 200; cm++) {
    const d = 0.04 + ((cm - 140) / 60) * 0.62
    const k = seg(t, d, d + 0.28)
    if (k <= 0) continue
    const y = yCm(cm)
    const major = cm % 10 === 0, mid = cm % 5 === 0
    const len = major ? 120 : mid ? 62 : 28
    const col = major ? 'rgba(156,195,178,0.9)' : mid ? 'rgba(156,195,178,0.55)' : 'rgba(156,195,178,0.3)'
    drawLine(150, y, 150 + len, y, ease.out3(k), col, major ? 1.5 : 1)
    if (major) {
      mono(String(cm), 72, y + 7, C.celadon, 20, 'left', ease.sine(k) * 0.9)
      // 라인업 벽: 무대 전체를 가로지르는 희미한 선
      const low = y > 1270 ? 1 - 0.85 * bmiIn : 1
      drawLineA(282, y, W - 40, y, ease.out3(k), C.celadon, 1, 0.13 * ease.sine(k) * low)
    } else if (mid) {
      const low = y > 1270 ? 1 - 0.85 * bmiIn : 1
      drawLineA(224, y, W - 40, y, ease.out3(k), C.celadon, 1, 0.05 * ease.sine(k) * low)
    }
  }
  mono('cm', 72, yCm(200) - 52, C.celadonDeep, 18, 'left', ease.sine(seg(t, 0.5, 0.9)))
  ;[...'身長尺'].forEach((ch, j) => text(ch, 84, yCm(140) + 62 + j * 26, `400 20px ${FONT.serif}`, C.celadonDeep, { align: 'center', alpha: ease.sine(seg(t, 0.2, 0.6)) }))
}

function heightMarker(t: number) {
  const kOn = seg(t, TH.mark[0] - 0.1, TH.mark[0] + 0.1)
  if (kOn <= 0) return 140
  const k = ease.p4out(seg(t, TH.mark[0], TH.mark[1]))
  const h = lerp(140, 173, k)
  const y = yCm(h)
  scanPlane(y, 96, SL.x, kOn)
  // 포인터
  ctx.save(); ctx.globalAlpha = kOn; ctx.fillStyle = C.amberCore
  ctx.beginPath(); ctx.moveTo(136, y - 9); ctx.lineTo(150, y); ctx.lineTo(136, y + 9); ctx.closePath(); ctx.fill(); ctx.restore()
  mono(h.toFixed(1), SL.x - 22, y - 18, C.amberCore, 22, 'right', kOn)
  return h
}

function profileSlab(i: number, t: number, hNow: number) {
  const row = ROWS[i]
  const x = SL.x, w = SL.w, h = SL.h, y = slabTop(i)
  const kIn = ease.out3(seg(t, 0.12 + i * 0.09, 0.55 + i * 0.09))
  if (kIn <= 0) return
  const [a, b] = row.win
  const kVal = seg(t, a, b)
  const act = clamp(Math.min(seg(t, a - 0.12, a + 0.04), 1 - seg(t, b + 0.04, b + 0.4)))
  // 몸체: 먹돌 — 왼쪽이 짙고 오른쪽으로 옅어지는 판, 결이 보인다
  ctx.save()
  ctx.globalAlpha = kIn
  const body = ctx.createLinearGradient(x, 0, x + w, 0)
  body.addColorStop(0, 'rgba(16,18,20,0.94)'); body.addColorStop(1, 'rgba(12,14,16,0.72)')
  ctx.fillStyle = body; ctx.fillRect(x, y, w, h)
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  ctx.fillStyle = ctx.createPattern(stone(), 'repeat')!
  ctx.translate(i * 97, i * 53); ctx.fillRect(x - i * 97, y - i * 53, w, h)
  ctx.restore()
  if (act > 0) {
    // 입력 중: 왼쪽 앰버 띠에서 빛이 석판 위로 번진다 + 한지 결이 희미하게 비친다
    hanji(x, y, w, h, act * 0.05, { halo: false })
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const sp = ctx.createRadialGradient(x, y + h / 2, 10, x, y + h / 2, w * 0.75)
    sp.addColorStop(0, `rgba(232,166,75,${0.3 * act})`); sp.addColorStop(0.35, `rgba(232,166,75,${0.1 * act})`); sp.addColorStop(1, 'rgba(232,166,75,0)')
    ctx.fillStyle = sp; ctx.fillRect(x, y, w, h)
    ctx.restore()
  }
  // 윗면 반사(샴페인 금) + 아랫면 그늘
  ctx.save()
  const spec = ctx.createLinearGradient(x, 0, x + w, 0)
  spec.addColorStop(0, 'rgba(210,185,138,0)'); spec.addColorStop(0.3, `rgba(210,185,138,${0.55 * kIn})`); spec.addColorStop(1, 'rgba(210,185,138,0.04)')
  ctx.fillStyle = spec; ctx.fillRect(x, y, w * kIn, 1)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y + h - 2, w, 2)
  ctx.restore()
  // 맞춤표(청자)
  for (const [cx, cy, sx, sy] of [[x + w, y, -1, 1], [x + w, y + h, -1, -1]] as const) {
    hair(cx + 8, cy, cx + 8 + sx * 18, cy, C.celadon, 1.1, 0.7 * kIn)
    hair(cx + 8, cy, cx + 8, cy + sy * 18, C.celadon, 1.1, 0.7 * kIn)
  }
  // 왼쪽 띠: 입력 중이면 앰버, 끝나면 금
  ctx.save(); ctx.globalAlpha = kIn
  ctx.fillStyle = act > 0.05 ? `rgba(232,166,75,${0.35 + 0.65 * act})` : kVal >= 1 ? 'rgba(210,185,138,0.5)' : 'rgba(156,195,178,0.25)'
  ctx.fillRect(x, y, 3, h); ctx.restore()
  // 한자 세로 라벨 + 구분선
  ;[...row.hz].forEach((ch, j) => text(ch, x + 50, y + h / 2 - 22 + j * 46, `200 36px ${FONT.serif}`, C.celadon, { align: 'center', baseline: 'middle', alpha: 0.9 * kIn }))
  hair(x + 92, y + 34, x + 92, y + h - 34, 'rgba(156,195,178,0.25)', 1, kIn)
  text(row.ko, x + 124, y + 52, `400 24px ${FONT.sans}`, C.hanjiShadow, { alpha: kIn * 0.95, spacing: 2 })
  mono(`0${i + 1}`, x + w - 26, y + 52, C.ash, 18, 'right', 0.7 * kIn)
  if (kVal <= 0) {
    // 아직 입력 전: 빈 자리
    hair(x + 124, y + 160, x + 300, y + 160, 'rgba(156,195,178,0.2)', 1, kIn)
    return
  }
  const kv = ease.out3(clamp(kVal * 2.2))
  const blur = (1 - kv) * 12
  let val: string
  const wNow = lerp(48, 61, ease.out3(kVal))
  if (i === 2) val = String(Math.round(hNow))
  else if (i === 3) val = String(Math.round(wNow))
  else val = i === 0 ? '남' : '35'
  const vx = x + 124, vy = y + 166
  const font = i === 0 ? `300 108px ${FONT.hahmlet}` : `italic 300 150px ${FONT.italic}`
  const col = act > 0.3 ? '#FFF3DE' : C.pearl
  text(val, vx, vy, font, col, { alpha: kv, blur })
  ctx.save(); ctx.font = font; const vw = ctx.measureText(i === 2 ? '173' : val).width; ctx.restore()
  if (row.unit) {
    if (row.unit === '세') text(row.unit, vx + vw + 14, vy - 6, `400 32px ${FONT.sans}`, C.hanjiShadow, { alpha: kv })
    else mono(row.unit, vx + vw + 14, vy - 6, C.hanjiShadow, 28, 'left', kv)
  }
  const raw = i === 3 ? `W · ${wNow.toFixed(1)}` : i === 2 ? `H · ${hNow.toFixed(1)}` : row.raw
  mono(raw, x + w - 26, y + h - 30, act > 0.3 ? C.amber : C.ash, 18, 'right', 0.75 * kv)
}

/** 레이저 각인: 왼→오른쪽으로 뜨거운 가장자리가 지나가며 금빛으로 식는다 */
function engrave(s: string, x: number, y: number, size: number, k: number, t: number) {
  if (k <= 0) return
  const font = `italic 300 ${size}px ${FONT.italic}`
  ctx.save(); ctx.font = font; const tw = ctx.measureText(s).width; ctx.restore()
  const fx = x + (tw + 30) * ease.inOut3(k)
  const G = offscreen(() => clipRect(x - 30, y - size, fx - x + 30, size * 1.35, () => text(s, x, y, font, C.gold)))
  ctx.drawImage(G, 0, 0)
  bloom(G, [8], [0.22])
  if (k < 1) {
    const hot = offscreen(() => clipRect(fx - 90, y - size, 90, size * 1.35, () => {
      const g = ctx.createLinearGradient(fx - 90, 0, fx, 0)
      g.addColorStop(0, 'rgba(255,208,138,0)'); g.addColorStop(1, 'rgba(255,236,200,1)')
      text(s, x, y, font, C.amberCore)
      ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(fx - 90, y - size, 90, size * 1.35)
    }))
    ctx.drawImage(hot, 0, 0)
    // 각인 레이저 선 + 불꽃
    const S = offscreen(() => {
      hair(fx, y - size * 0.78, fx, y + 14, C.amberCore, 1.6)
      const r = rng(1 + Math.floor(t * 40))
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(255,226,170,${0.4 + r() * 0.6})`
        ctx.beginPath(); ctx.arc(fx + (r() - 0.3) * 26, y - r() * size * 0.7, 0.8 + r() * 1.6, 0, 6.283); ctx.fill()
      }
    })
    ctx.drawImage(S, 0, 0)
    bloom(hot, [4, 16], [0.7, 0.5])
    bloom(S, [5, 22], [0.9, 0.6])
  }
}

function bmiBlock(t: number) {
  const y0 = 1292, x = SL.x, w = SL.w
  const k0 = ease.out3(seg(t, TH.bmi, TH.bmi + 0.4))
  if (k0 <= 0) return
  drawLine(x, y0, x + w, y0, k0, 'rgba(210,185,138,0.55)', 1)
  mono('BMI', x, y0 + 44, C.gold, 22, 'left', k0)
  text('체질량지수', x + 74, y0 + 44, `400 22px ${FONT.sans}`, C.hanjiShadow, { alpha: k0, spacing: 2 })
  const f = ['61.0 kg', '÷ (1.73 m)²', '= 20.38']
  f.forEach((s, i) => {
    const k = ease.sine(seg(t, TH.bmi + 0.1 + i * 0.13, TH.bmi + 0.4 + i * 0.13))
    mono(s, x + w, y0 + 92 + i * 40, i === 2 ? C.amber : C.ash, 24, 'right', k)
  })
  engrave('20.4', x - 6, y0 + 228, 200, seg(t, TH.bmi + 0.28, TH.bmi + 0.85), t)
  // 척도
  const yS = 1604
  const kS = ease.out3(seg(t, TH.bmi + 0.45, TH.bmi + 0.85))
  const sx = (v: number) => x + ((v - 15) / 15) * w
  drawLine(x, yS, x + w, yS, kS, 'rgba(156,195,178,0.4)', 1)
  drawLineA(sx(18.5), yS, sx(23), yS, kS, C.celadon, 3, kS * 0.9)
  for (const v of [15, 18.5, 23, 25, 30]) {
    hair(sx(v), yS - 6, sx(v), yS + 6, C.celadon, 1, kS * 0.7)
    if (v !== 15 && v !== 30) mono(String(v), sx(v), yS + 40, C.ash, 16, 'center', kS * 0.8)
  }
  text('정상 범위 18.5–22.9', (sx(18.5) + sx(23)) / 2, yS - 16, `400 18px ${FONT.sans}`, C.celadon, { align: 'center', alpha: kS * 0.7, spacing: 2 })
  const km = ease.p4out(seg(t, TH.bmi + 0.75, TH.bmi + 1.05))
  if (km > 0) {
    const mx = lerp(x, sx(20.4), km)
    ctx.save(); ctx.globalAlpha = km; ctx.fillStyle = C.amberCore
    ctx.beginPath(); ctx.moveTo(mx - 7, yS + 17); ctx.lineTo(mx + 7, yS + 17); ctx.lineTo(mx, yS + 5); ctx.closePath(); ctx.fill(); ctx.restore()
    const D = offscreen(() => { ctx.fillStyle = C.amberCore; ctx.beginPath(); ctx.arc(mx, yS, 3.5, 0, 6.283); ctx.fill() })
    ctx.drawImage(D, 0, 0); bloom(D, [5, 18], [0.9 * km, 0.5 * km])
  }
}

/** 8엽 조리개 (S06의 개방과 짝을 이룬다). r=개구 반경 */
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
  // 바탕(날개 사이 틈 방지)
  ctx.fillStyle = '#060708'
  ctx.beginPath(); ctx.rect(0, 0, W, H)
  ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath()
  ctx.fill('evenodd')
  // 날개: 개구 변 하나 + 양쪽 이음선으로 둘러싸인 판. 개구 쪽이 살짝 밝은 금속 결
  for (let i = 0; i < n; i++) {
    const p = pts[(i + 1) % n], q = pts[(i + 2) % n]
    const [ux, uy] = dir(i), [vx, vy] = dir(i + 1)
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2
    const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1
    const g = ctx.createLinearGradient(mx, my, mx + (ox / ol) * 700, my + (oy / ol) * 700)
    const hi = i % 2 ? 0.09 : 0.06
    g.addColorStop(0, `rgba(40,42,44,${0.6 + hi})`); g.addColorStop(0.12, `rgba(22,24,26,1)`); g.addColorStop(1, 'rgba(8,9,10,1)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] + vx * L, q[1] + vy * L); ctx.lineTo(p[0] + ux * L, p[1] + uy * L); ctx.closePath(); ctx.fill()
  }
  // 이음선 그림자 + 금 헤어라인
  for (let i = 0; i < n; i++) {
    const [bx, by] = pts[(i + 1) % n]
    const [ux, uy] = dir(i)
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#000'; ctx.lineWidth = 12; ctx.filter = 'blur(7px)'
    ctx.beginPath(); ctx.moveTo(bx + uy * 7, by - ux * 7); ctx.lineTo(bx + ux * L + uy * 7, by + uy * L - ux * 7); ctx.stroke(); ctx.restore()
    hair(bx, by, bx + ux * L, by + uy * L, C.gold, 1, 0.3 * ea)
  }
  // 개구 가장자리 반사
  ctx.globalAlpha = 0.6 * ea
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.stroke()
  ctx.restore()
}

const S05: Scene = {
  id: 'S05',
  act: '입문',
  title: '신상 계측',
  note: '어둠 속 라인업 눈금자에서 앰버 수평면이 173 cm까지 떠올라 키 석판과 맞물리고, 성별·나이·몸무게가 차례로 맺힌 뒤 BMI 20.4가 레이저로 각인된다. 8엽 조리개가 닫히며 암전.',
  dur: 4,
  render(t) {
    // 어두운 무대: 먹이 스민 어둠 + 천장의 아주 옅은 잔광과 먼지
    const amb = ease.sine(seg(t, 0, 0.8))
    drawBlur(inkBg(), 0, 0.55 * amb)
    ctx.save()
    const g = ctx.createRadialGradient(W * 0.62, -200, 50, W * 0.62, 200, 1500)
    g.addColorStop(0, `rgba(232,166,75,${0.1 * amb})`); g.addColorStop(1, 'rgba(232,166,75,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore()
    dust(W * 0.62, 700, 1100, H, 260, t + 20, 9, '255,214,150', 0.35 * amb)

    // 카메라: 아주 느린 푸시 인
    const push = lerp(1, 1.035, ease.sine(seg(t, 0, TH.iris[1])))
    ctx.save()
    ctx.translate(600, 980); ctx.scale(push, push); ctx.translate(-600, -980)
    ruler(t)
    const hNow = heightMarker(t)
    // 석판: 초점이 옮겨 가는 얕은 심도
    const fv = focusAt(t)
    const seq = seg(t, 0.4, 0.6)
    for (let i = 0; i < 4; i++) {
      const L = offscreen(() => profileSlab(i, t, hNow))
      const d = Math.min(1, Math.abs(fv - i)) * seq
      const y = slabTop(i) - 30
      ctx.save()
      ctx.globalAlpha = 1 - 0.38 * d
      if (d > 0.04) ctx.filter = `blur(${d * 3.4}px)`
      ctx.drawImage(L, 0, y, W, SL.h + 60, 0, y, W, SL.h + 60)
      ctx.restore()
    }
    // 수평면이 키 석판에 닿는 접점
    const kHit = seg(t, 1.5, 2.0) * (1 - seg(t, 2.6, 3.1))
    if (kHit > 0) {
      const y = yCm(hNow)
      const D = offscreen(() => { ctx.fillStyle = C.amberCore; ctx.beginPath(); ctx.arc(SL.x, y, 4, 0, 6.283); ctx.fill() })
      bloom(D, [6, 24], [0.9 * kHit, 0.6 * kHit])
    }
    bmiBlock(t)
    ctx.restore()

    header('墨光判讀室 · INK-LIGHT READING ROOM', '入門 · PROFILE', ease.sine(seg(t, 0.1, 0.6)))
    disclaimer(ease.sine(seg(t, 0.2, 0.8)))
    vignette(0.65)

    // 조리개가 닫힌다 → S06에서 같은 중심으로 열린다
    const ki = seg(t, TH.iris[0], TH.iris[1])
    if (ki > 0) {
      const e = ease.inOut3(ki)
      aperture(540, 760, lerp(1250, 0, e), 0.6 * e + 0.15)
    }
    // 빛이 닫히며 날개도 어둠에 잠긴다
    blackout(ease.sine(seg(t, TH.iris[0] + 0.4, 4)))
  },
}

export const scenes: Scene[] = [S04, S05]
