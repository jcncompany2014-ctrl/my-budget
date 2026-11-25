// 시안용 키프레임 렌더러 (개발 도구). /design/keyframes.html?d=A|B|C
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import demo from '../src/data/demoFace.json'
import '@fontsource/noto-serif-kr/200.css'
import '@fontsource/noto-serif-kr/400.css'
import '@fontsource/noto-serif-kr/900.css'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/cormorant-garamond/300-italic.css'
import '@fontsource/hahmlet/300.css'
import '@fontsource/hahmlet/700.css'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'

const W = 1080
const H = 1920
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

type Pt = { x: number; y: number; s: number; edge: number }

/** 랜드마크 메쉬 에지를 따라 점을 뿌려 포인트 클라우드 생성 */
function faceCloud(cx: number, cy: number, width: number, perEdge = 9): { pts: Pt[]; lm: { x: number; y: number }[] } {
  const raw = demo.lm.map(([x, y]) => ({ x: x * demo.w, y: y * demo.h }))
  const xs = raw.map((p) => p.x)
  const ys = raw.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const sc = width / (maxX - minX)
  const ox = cx - ((minX + maxX) / 2) * sc
  const oy = cy - ((minY + maxY) / 2) * sc
  const lm = raw.map((p) => ({ x: W - (p.x * sc + ox) + (2 * cx - W), y: p.y * sc + oy })) // mirror around cx
  closeMouth(lm)
  const rx = width / 2
  const ry = ((maxY - minY) * sc) / 2
  const shade = (x: number, y: number) => {
    const u = (x - cx) / rx, v = (y - cy) / ry
    return Math.max(0, Math.sqrt(Math.max(0, 1 - u * u * 0.9 - v * v * 0.8)))
  }
  const pts: Pt[] = []
  for (const e of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    const a = lm[e.start], b = lm[e.end]
    for (let i = 0; i < perEdge; i++) {
      const t = rnd()
      const x = a.x + (b.x - a.x) * t + (rnd() - 0.5) * 1.2
      const y = a.y + (b.y - a.y) * t + (rnd() - 0.5) * 1.2
      pts.push({ x, y, s: shade(x, y), edge: 0 })
    }
  }
  const contours = [
    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, FaceLandmarker.FACE_LANDMARKS_LIPS,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  ]
  for (const c of contours) for (const e of c) {
    const a = lm[e.start], b = lm[e.end]
    for (let i = 0; i < 24; i++) {
      const t = i / 24
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
      pts.push({ x, y, s: shade(x, y), edge: 1 })
    }
  }
  return { pts, lm }
}

/** 샘플 얼굴이 활짝 웃고 있어 입을 다문 무표정으로 보정 */
function closeMouth(lm: { x: number; y: number }[]) {
  const inner = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 95, 88, 178, 87, 14, 317, 402, 318, 324]
  const lowerOuter = [146, 91, 181, 84, 17, 314, 405, 321, 375]
  const L = lm[78], Rr = lm[308]
  const gap = lm[14].y - lm[13].y
  const cY = (lm[13].y + lm[14].y) / 2 - gap * 0.1
  const mid = (x: number) => {
    const t = (x - L.x) / (Rr.x - L.x) // 0..1
    const edge = L.y + (Rr.y - L.y) * t
    return edge + (cY - (L.y + Rr.y) / 2) * (1 - (2 * t - 1) ** 2) * 0.5 + gap * 0.18
  }
  for (const i of inner) lm[i] = { x: lm[i].x, y: mid(lm[i].x) }
  for (const i of lowerOuter) lm[i] = { x: lm[i].x, y: lm[i].y - gap * 0.85 }
  // 입꼬리 살짝 내림
  for (const i of [61, 291, 78, 308]) lm[i] = { x: lm[i].x, y: lm[i].y + gap * 0.25 }
}

function layer() {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  return { c, x: c.getContext('2d')! }
}

/** 블룸: 레이어를 여러 반경으로 흐려 가산 합성 */
function bloom(src: HTMLCanvasElement, radii: number[], alpha: number[]) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  radii.forEach((r, i) => {
    ctx.filter = `blur(${r}px)`
    ctx.globalAlpha = alpha[i]
    ctx.drawImage(src, 0, 0)
  })
  ctx.restore()
}

function grain(amount: number) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount
    d[i] += n; d[i + 1] += n; d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

function vignette(strength: number) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function text(s: string, x: number, y: number, font: string, color: string, opts: { align?: CanvasTextAlign; spacing?: number; alpha?: number } = {}) {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = opts.align ?? 'left'
  ctx.globalAlpha = opts.alpha ?? 1
  if (opts.spacing) ctx.letterSpacing = `${opts.spacing}px`
  ctx.fillText(s, x, y)
  ctx.restore()
}

function vtext(s: string, x: number, y: number, size: number, font: string, color: string, gap = 1.15) {
  ;[...s].forEach((ch, i) => text(ch, x, y + i * size * gap, `${size}px ${font}`, color, { align: 'center' }))
}

function hair(x0: number, y0: number, x1: number, y1: number, color: string, w = 1) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore()
}

/* ───────────── A. 판독실 READING BAY ───────────── */
function renderA() {
  ctx.fillStyle = '#020303'; ctx.fillRect(0, 0, W, H)
  const cx = 540, cy = 800
  // 볼류메트릭 빛기둥
  const beam = layer()
  const g = beam.x.createLinearGradient(0, 0, 0, 1560)
  g.addColorStop(0, 'rgba(255,208,138,0.55)'); g.addColorStop(0.55, 'rgba(232,166,75,0.22)'); g.addColorStop(1, 'rgba(232,166,75,0.05)')
  beam.x.fillStyle = g
  beam.x.beginPath(); beam.x.moveTo(cx - 120, 0); beam.x.lineTo(cx + 120, 0); beam.x.lineTo(cx + 420, 1560); beam.x.lineTo(cx - 420, 1560); beam.x.closePath(); beam.x.fill()
  ctx.save(); ctx.filter = 'blur(60px)'; ctx.globalAlpha = 0.75; ctx.drawImage(beam.c, 0, 0); ctx.restore()
  ctx.save(); ctx.filter = 'blur(18px)'; ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255,220,160,0.5)'; ctx.fillRect(cx - 14, 0, 28, 1500); ctx.restore()
  // 바닥 반사
  const fl = ctx.createRadialGradient(cx, 1570, 10, cx, 1570, 460)
  fl.addColorStop(0, 'rgba(232,166,75,0.35)'); fl.addColorStop(1, 'rgba(232,166,75,0)')
  ctx.save(); ctx.scale(1, 0.18); ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(cx, 1570 / 0.18, 460, 0, 7); ctx.restore()
  ctx.save(); ctx.translate(0, 1570); ctx.scale(1, 0.16); ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(cx, 0, 520, 0, 7); ctx.fill(); ctx.restore()
  // 먼지
  const dust = layer()
  for (let i = 0; i < 2400; i++) {
    const y = rnd() * 1560
    const half = 120 + (y / 1560) * 300
    const x = cx + (rnd() * 2 - 1) * half * Math.sqrt(rnd())
    dust.x.fillStyle = `rgba(255,214,150,${0.15 + rnd() * 0.55})`
    const r = rnd() < 0.04 ? 2.4 : 0.9
    dust.x.beginPath(); dust.x.arc(x, y, r, 0, 7); dust.x.fill()
  }
  ctx.drawImage(dust.c, 0, 0)
  bloom(dust.c, [4], [0.6])

  // 포인트 클라우드 얼굴
  const { pts, lm } = faceCloud(cx, cy, 560, 8)
  const scanY = lm[2].y // 코 밑
  const f = layer()
  for (const p of pts) {
    const near = Math.exp(-((p.y - scanY) ** 2) / 900)
    const a = Math.min(1, 0.12 + p.s * 0.55 + near * 0.9 + p.edge * 0.25)
    const lit = p.y < scanY ? 1 : 0.35 // 아직 스캔 안 된 아래쪽은 어둡게
    f.x.fillStyle = near > 0.4 ? `rgba(255,236,200,${a})` : `rgba(232,166,75,${a * lit})`
    f.x.fillRect(p.x - 0.8, p.y - 0.8, 1.6 + p.edge * 0.6, 1.6 + p.edge * 0.6)
  }
  ctx.drawImage(f.c, 0, 0)
  bloom(f.c, [3, 14, 40], [0.9, 0.55, 0.35])
  // 스캔 평면
  const sp = layer()
  const sg = sp.x.createLinearGradient(0, scanY - 70, 0, scanY)
  sg.addColorStop(0, 'rgba(255,208,138,0)'); sg.addColorStop(1, 'rgba(255,208,138,0.28)')
  sp.x.fillStyle = sg; sp.x.fillRect(110, scanY - 70, 860, 70)
  sp.x.fillStyle = 'rgba(255,240,210,1)'; sp.x.fillRect(70, scanY - 1, 940, 2)
  ctx.drawImage(sp.c, 0, 0)
  bloom(sp.c, [6, 24], [0.9, 0.6])

  // 계측 주석
  const ash = 'rgba(140,135,124,0.9)'
  const mono = (s: string, x: number, y: number, c = '#8C877C', size = 22, al: CanvasTextAlign = 'left') =>
    text(s, x, y, `300 ${size}px "IBM Plex Mono"`, c, { align: al, spacing: 2.5 })
  const top = lm[10].y, brow = lm[9].y, chin = lm[152].y
  const rX = 870
  for (const [y, lab, v] of [[top, '', ''], [brow, '上停', '0.27'], [scanY, '中停', '0.33'], [chin, '下停', '0.39']] as const) {
    hair(cx + 230, y, rX, y, ash, 1)
    if (lab) { text(lab, rX + 14, y - 12, '400 26px "Noto Serif KR"', '#E9E2D3'); mono(v, rX + 70, y - 13, '#E8A64B', 22) }
  }
  hair(rX, top, rX, chin, ash, 1)
  // 레티클
  const eL = lm[33], eR = lm[263]
  ctx.save(); ctx.strokeStyle = 'rgba(232,166,75,0.9)'; ctx.lineWidth = 1.5
  for (const e of [eL, eR]) { ctx.beginPath(); ctx.arc(e.x, e.y, 26, 0, 7); ctx.stroke(); hair(e.x - 40, e.y, e.x - 30, e.y, '#E8A64B'); hair(e.x + 30, e.y, e.x + 40, e.y, '#E8A64B') }
  ctx.restore()
  hair(eL.x - 26, eL.y, 140, eL.y - 150, ash); mono('目 · 0.22  −1.3σ', 120, eL.y - 162, '#B8B2A5', 22)
  const n1 = lm[129], n2 = lm[358]
  hair(n1.x, n1.y + 18, n2.x, n2.y + 18, '#E8A64B', 1.5)
  hair(n1.x, n1.y + 10, 160, n1.y + 120, ash); mono('鼻廣 · 0.35  +3.0σ', 120, n1.y + 150, '#B8B2A5', 22)

  // 브래킷
  const bx0 = cx - 330, bx1 = cx + 330, by0 = top - 70, by1 = chin + 50, L = 46
  ctx.save(); ctx.strokeStyle = 'rgba(233,226,211,0.75)'; ctx.lineWidth = 2
  for (const [x, y, dx, dy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke()
  }
  ctx.restore()
  mono('LOCK · 01', bx0, by0 - 18, '#E8A64B', 22)
  mono('YAW +0.6°  PITCH −1.2°', bx1, by0 - 18, '#8C877C', 20, 'right')

  // 헤더
  mono('判讀室 · READING BAY', 72, 110, '#8C877C', 22)
  mono('STEP 3 / 3 · 체질 판정', W - 72, 110, '#8C877C', 22, 'right')
  hair(72, 132, W - 72, 132, 'rgba(140,135,124,0.35)')

  // 결과 타이포
  const ty = 1700
  const tl = layer()
  tl.x.font = '200 200px "Noto Serif KR"'; tl.x.fillStyle = '#E9E2D3'; tl.x.textAlign = 'center'; tl.x.letterSpacing = '24px'
  tl.x.fillText('太陰人', cx + 12, ty)
  ctx.drawImage(tl.c, 0, 0)
  bloom(tl.c, [10], [0.35])
  text('태음인', cx, ty + 92, '300 56px "IBM Plex Mono", "Noto Serif KR"', '#E9E2D3', { align: 'center' })
  mono('TAEEUM-IN · 경향 82%', cx, ty + 148, '#E8A64B', 24, 'center')
  vignette(0.75)
  grain(16)
}

/* ───────────── B. 묵광의례 MUKGWANG ───────────── */
function renderB() {
  ctx.fillStyle = '#07080A'; ctx.fillRect(0, 0, W, H)
  const wx = 150, wy = 200, ww = 780, wh = 1180
  const cx = wx + ww / 2, cy = wy + 560
  // 창호 역광 글로우
  ctx.save(); ctx.filter = 'blur(90px)'; ctx.fillStyle = 'rgba(241,230,207,0.35)'; ctx.fillRect(wx - 40, wy - 40, ww + 80, wh + 80); ctx.restore()
  // 한지
  const hj = ctx.createRadialGradient(cx, wy + 480, 80, cx, wy + 600, 900)
  hj.addColorStop(0, '#FBF2DE'); hj.addColorStop(0.6, '#EBDCBF'); hj.addColorStop(1, '#C9B590')
  ctx.fillStyle = hj; ctx.fillRect(wx, wy, ww, wh)
  // 한지 섬유
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip()
  for (let i = 0; i < 2600; i++) {
    const x = wx + rnd() * ww, y = wy + rnd() * wh, a = rnd() * Math.PI, l = 8 + rnd() * 40
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '255,250,235' : '160,140,105'},${0.08 + rnd() * 0.16})`
    ctx.lineWidth = 0.6 + rnd() * 0.8
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke()
  }
  // 먹 번짐 (얼굴 아래로 퍼지는 담묵)
  const ink = layer()
  for (let i = 0; i < 70; i++) {
    const x = cx + (rnd() - 0.5) * 520, y = cy + 120 + rnd() * 520
    const r = 30 + rnd() * 120
    ink.x.fillStyle = `rgba(10,12,14,${0.05 + rnd() * 0.08})`
    ink.x.beginPath(); ink.x.arc(x, y, r, 0, 7); ink.x.fill()
  }
  ctx.save(); ctx.filter = 'blur(26px)'; ctx.drawImage(ink.c, 0, 0); ctx.restore()
  // 얼굴: 먹 점묘 + 먹선
  const { pts, lm } = faceCloud(cx, cy, 500, 7)
  const f = layer()
  for (const p of pts) {
    const a = Math.min(0.95, 0.1 + (1 - p.s) * 0.55 + p.edge * 0.5)
    f.x.fillStyle = `rgba(12,13,15,${a})`
    const r = p.edge ? 1.5 + rnd() * 1.6 : 0.8 + rnd() * 0.9
    f.x.beginPath(); f.x.arc(p.x, p.y, r, 0, 7); f.x.fill()
  }
  ctx.save(); ctx.filter = 'blur(5px)'; ctx.globalAlpha = 0.55; ctx.drawImage(f.c, 0, 0); ctx.restore() // 번짐
  ctx.drawImage(f.c, 0, 0)
  ctx.restore()

  // 청자 계측선
  const cel = '#3F6A5E', celL = '#9CC3B2'
  const top = lm[10].y, brow = lm[9].y, base = lm[2].y, chin = lm[152].y
  for (const [y, lab] of [[top, '天'], [brow, '人'], [base, '地']] as const) {
    hair(wx + 30, y, wx + ww - 30, y, 'rgba(63,106,94,0.7)', 1.2)
    text(lab, wx + ww - 46, y - 10, '400 26px "Noto Serif KR"', cel)
  }
  hair(wx + 30, chin, wx + ww - 30, chin, 'rgba(63,106,94,0.7)', 1.2)
  // 판독 렌즈 (눈 부위)
  const e = { x: (lm[33].x + lm[263].x) / 2, y: (lm[33].y + lm[263].y) / 2 }
  ctx.save(); ctx.strokeStyle = cel; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(e.x, e.y, 190, 0, 7); ctx.stroke()
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, l = i % 6 === 0 ? 16 : 7
    hair(e.x + Math.cos(a) * 190, e.y + Math.sin(a) * 190, e.x + Math.cos(a) * (190 + l), e.y + Math.sin(a) * (190 + l), cel, i % 6 === 0 ? 2 : 1)
  }
  ctx.restore()
  hair(e.x + 170, e.y + 90, wx + ww + 10, e.y + 230, cel, 1.2)
  text('눈꼬리 각', wx + ww + 18, e.y + 262, '500 24px "Pretendard Variable"', '#A89D88')
  text('+4.2°', wx + ww + 18, e.y + 302, '300 34px "IBM Plex Mono"', celL)

  // 세로쓰기 라벨
  vtext('觀形', W - 60, 300, 44, '"Noto Serif KR"', '#E9E2D3')
  vtext('형상판독', W - 60, 430, 26, '"Pretendard Variable"', '#A89D88', 1.25)
  text('1 / 3', W - 60, 600, '300 22px "IBM Plex Mono"', '#9CC3B2', { align: 'center' })
  vtext('上停中停下停', 70, 420, 30, '"Noto Serif KR"', '#5D564A', 1.4)

  // 주사 낙관
  ctx.save(); ctx.translate(wx + ww - 130, wy + wh - 150); ctx.rotate(-0.05)
  ctx.fillStyle = '#C8341F'; ctx.fillRect(0, 0, 120, 120)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.6})`; ctx.fillRect(rnd() * 120, rnd() * 120, 1 + rnd() * 3, 1 + rnd() * 3) }
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#F6E9D4'; ctx.font = '900 46px "Noto Serif KR"'; ctx.textAlign = 'center'
  ctx.fillText('觀', 60, 54); ctx.fillText('形', 60, 104)
  ctx.restore()

  // 하단: 측정 문구 + 안내
  text('上停 : 中停 : 下停', cx, 1520, '400 34px "Noto Serif KR"', '#A89D88', { align: 'center' })
  text('1  :  1.04  :  0.97', cx, 1590, '300 64px "IBM Plex Mono"', '#F1E6CF', { align: 'center' })
  text('먹이 번지는 동안 잠시 그대로 계셔 주세요', cx, 1720, '700 40px "Hahmlet"', '#F1E6CF', { align: 'center' })
  hair(cx - 200, 1780, cx + 200, 1780, 'rgba(156,195,178,0.35)')
  text('墨光儀禮 · MUKGWANG', cx, 1830, '300 22px "IBM Plex Mono"', '#5D564A', { align: 'center', spacing: 3 })
  vignette(0.6)
  grain(12)
}

/* ───────────── C. 유리 초상 GLASS PORTRAIT ───────────── */
function renderC() {
  ctx.fillStyle = '#060709'; ctx.fillRect(0, 0, W, H)
  const cx = 540, cy = 760
  // 탑 스포트
  const sp = ctx.createRadialGradient(cx, 300, 20, cx, 760, 760)
  sp.addColorStop(0, 'rgba(255,244,220,0.16)'); sp.addColorStop(1, 'rgba(255,244,220,0)')
  ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H)
  // 배경 보케
  const bk = layer()
  const tints = ['255,244,220', '143,188,165', '210,185,138']
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * 1500, r = 30 + rnd() * 110
    bk.x.fillStyle = `rgba(${tints[i % 3]},${0.04 + rnd() * 0.07})`
    bk.x.beginPath(); bk.x.arc(x, y, r, 0, 7); bk.x.fill()
    bk.x.strokeStyle = `rgba(${tints[i % 3]},${0.05 + rnd() * 0.06})`; bk.x.lineWidth = 2; bk.x.stroke()
  }
  ctx.save(); ctx.filter = 'blur(3px)'; ctx.drawImage(bk.c, 0, 0); ctx.restore()

  // 펄 입자 흉상 + 림 틴트(태음 셀라돈)
  const { pts, lm } = faceCloud(cx, cy, 540, 10)
  const focusY = lm[168].y
  const f = layer(), bo = layer()
  for (const p of pts) {
    const dz = Math.abs(p.y - focusY) / 520 // 초점면에서 멀수록 보케
    const rim = 1 - p.s
    const col = rim > 0.55 ? `143,188,165` : `243,238,229`
    const a = Math.min(1, 0.18 + p.s * 0.6 + p.edge * 0.2)
    if (dz > 0.42 && rnd() < 0.06) {
      const r = 4 + dz * 16
      bo.x.fillStyle = `rgba(${col},${0.05 + 0.05 * rnd()})`
      bo.x.beginPath(); bo.x.arc(p.x, p.y, r, 0, 7); bo.x.fill()
    } else if (dz < 0.55 || rnd() < 0.35) {
      f.x.fillStyle = `rgba(${col},${a * (1 - Math.min(0.7, dz))})`
      const r = 0.7 + rnd() * 0.7
      f.x.beginPath(); f.x.arc(p.x, p.y, r, 0, 7); f.x.fill()
    }
  }
  ctx.drawImage(bo.c, 0, 0)
  ctx.drawImage(f.c, 0, 0)
  bloom(f.c, [2.5, 12, 34], [0.8, 0.45, 0.3])

  // 틱 링 (진행 74%)
  const R = 450
  for (let i = 0; i < 120; i++) {
    const a = -Math.PI / 2 + (i / 120) * Math.PI * 2
    const on = i / 120 < 0.74
    hair(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + (i % 10 === 0 ? 26 : 16)), cy + Math.sin(a) * (R + (i % 10 === 0 ? 26 : 16)),
      on ? 'rgba(210,185,138,0.9)' : 'rgba(210,185,138,0.18)', 1.5)
  }
  // 물방울 렌즈
  const dx = cx, dy = 1300
  const drop = ctx.createRadialGradient(dx - 18, dy - 22, 4, dx, dy, 72)
  drop.addColorStop(0, 'rgba(255,250,240,0.9)'); drop.addColorStop(0.18, 'rgba(255,244,220,0.25)'); drop.addColorStop(0.8, 'rgba(255,244,220,0.04)'); drop.addColorStop(1, 'rgba(210,185,138,0.5)')
  ctx.fillStyle = drop; ctx.beginPath(); ctx.arc(dx, dy, 72, 0, 7); ctx.fill()
  ctx.save(); ctx.beginPath(); ctx.arc(dx, dy, 70, 0, 7); ctx.clip()
  ctx.translate(dx, dy); ctx.scale(1, -1); text('太陰人', 0, 14, '200 40px "Noto Serif KR"', 'rgba(243,238,229,0.55)', { align: 'center' }); ctx.restore()
  const drL = layer(); drL.x.fillStyle = 'rgba(255,244,220,0.9)'; drL.x.beginPath(); drL.x.arc(dx - 26, dy - 30, 9, 0, 7); drL.x.fill()
  ctx.drawImage(drL.c, 0, 0); bloom(drL.c, [8, 30], [0.8, 0.5])

  // 타이포
  text('No. 07 — 18', 72, 120, '300 italic 40px "Cormorant Garamond"', '#A8A196')
  text('TEMPERAMENT · 결과', W - 72, 116, '300 20px "IBM Plex Mono"', '#A8A196', { align: 'right', spacing: 3.6 })
  const ty = 1560
  const tl = layer()
  tl.x.font = '200 208px "Noto Serif KR"'; tl.x.fillStyle = '#F3EEE5'; tl.x.textAlign = 'center'; tl.x.letterSpacing = '8px'
  tl.x.fillText('태음인', cx + 4, ty)
  ctx.drawImage(tl.c, 0, 0); bloom(tl.c, [14], [0.3])
  text('Taeeum-in · 太陰人', cx, ty + 82, '300 italic 50px "Cormorant Garamond"', '#D2B98A', { align: 'center' })
  hair(cx - 160, ty + 128, cx + 160, ty + 128, 'rgba(210,185,138,0.5)', 0.8)
  text('경향 82%  ·  肝大肺小', cx, ty + 186, '500 34px "Pretendard Variable"', '#A8A196', { align: 'center' })
  vignette(0.7)
  grain(9)
}

;(async () => {
  await Promise.all([
    '200 40px "Noto Serif KR"', '400 40px "Noto Serif KR"', '900 40px "Noto Serif KR"', '300 20px "IBM Plex Mono"',
    'italic 300 40px "Cormorant Garamond"', '300 40px "Hahmlet"', '700 40px "Hahmlet"', '500 40px "Pretendard Variable"',
  ].map((f) => document.fonts.load(f, '太陰人少陽觀形上停中停下停天人地 태음인 결과 경향 먹이번지는동안잠시그대로계셔주세요 눈꼬리각 형상판독 Taeeum No. 0123456789')))
  const d = new URLSearchParams(location.search).get('d') ?? 'A'
  ;({ A: renderA, B: renderB, C: renderC } as Record<string, () => void>)[d]()
  document.title = 'done'
})()
