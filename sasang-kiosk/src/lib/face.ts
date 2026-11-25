import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/** 모델과 WASM은 public/ 아래에 번들되어 있어 오프라인 키오스크에서도 동작 */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const base = import.meta.env.BASE_URL
      const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`)
      const make = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        })
      try {
        return await make('GPU')
      } catch {
        return await make('CPU')
      }
    })()
    landmarkerPromise.catch(() => (landmarkerPromise = null))
  }
  return landmarkerPromise
}

export { FaceLandmarker }

type P = { x: number; y: number }

/** 측정 지표 (모두 얼굴 폭 등으로 정규화된 무차원 값) */
export interface FaceMetrics {
  faceRatio: number // 얼굴 길이 / 폭
  foreheadRatio: number // 이마 폭 / 광대 폭
  jawRatio: number // 하악 폭 / 광대 폭
  eyeOpen: number // 눈 높이 / 눈 길이
  eyeGap: number // 미간(눈 사이) / 눈 길이
  noseRatio: number // 코볼 폭 / 얼굴 폭
  mouthRatio: number // 입 폭 / 얼굴 폭
  lipRatio: number // 입술 두께 / 입 폭
  upper: number // 삼정: 상정 비율
  middle: number // 중정
  lower: number // 하정
  symmetry: number // 0~100
}

export const METRIC_INFO: Record<
  keyof Omit<FaceMetrics, 'upper' | 'middle' | 'lower' | 'symmetry'>,
  { label: string; hanja: string; mean: number; sd: number; low: string; high: string }
> = {
  faceRatio: { label: '안면 종횡비', hanja: '面長', mean: 1.2, sd: 0.07, low: '넓고 둥근', high: '길고 갸름' },
  foreheadRatio: { label: '이마 폭', hanja: '額廣', mean: 0.79, sd: 0.04, low: '좁음', high: '넓음' },
  jawRatio: { label: '턱 폭', hanja: '頤廣', mean: 0.8, sd: 0.04, low: '갸름', high: '넓고 각짐' },
  eyeOpen: { label: '눈 크기', hanja: '目大', mean: 0.3, sd: 0.06, low: '가늘고 작음', high: '크고 또렷' },
  eyeGap: { label: '미간 거리', hanja: '眉間', mean: 1.05, sd: 0.1, low: '좁음', high: '넓음' },
  noseRatio: { label: '코볼 폭', hanja: '鼻廣', mean: 0.26, sd: 0.022, low: '좁고 오똑', high: '넓고 큼' },
  mouthRatio: { label: '입 폭', hanja: '口廣', mean: 0.37, sd: 0.03, low: '작음', high: '큼' },
  lipRatio: { label: '입술 두께', hanja: '脣厚', mean: 0.3, sd: 0.07, low: '얇음', high: '두꺼움' },
}

const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** 정규화 좌표를 실제 픽셀 비율로 (가로세로 비가 다르므로) */
function toPx(lm: NormalizedLandmark[], w: number, h: number): P[] {
  return lm.map((p) => ({ x: p.x * w, y: p.y * h }))
}

export function computeMetrics(lm: NormalizedLandmark[], w: number, h: number): FaceMetrics {
  const p = toPx(lm, w, h)
  const faceW = d(p[234], p[454])
  const top = p[10]
  const chin = p[152]
  const faceH = d(top, chin)

  // 얼굴 수직축에 투영해서 삼정 계산
  const axis = { x: (chin.x - top.x) / faceH, y: (chin.y - top.y) / faceH }
  const proj = (q: P) => (q.x - top.x) * axis.x + (q.y - top.y) * axis.y
  const brow = mid(p[105], p[334])
  const noseBase = p[2]
  // 랜드마크 10은 실제 발제선보다 아래에 있으므로 상정은 보정 계수 적용 (추정치)
  const upperRaw = proj(brow) * 1.55
  const middleRaw = proj(noseBase) - proj(brow)
  const lowerRaw = faceH - proj(noseBase)
  const tot = upperRaw + middleRaw + lowerRaw

  const eyeWL = d(p[33], p[133])
  const eyeWR = d(p[362], p[263])
  const eyeHL = d(p[159], p[145])
  const eyeHR = d(p[386], p[374])
  const eyeW = (eyeWL + eyeWR) / 2

  const mouthW = d(p[61], p[291])
  const lipH = d(p[0], p[13]) + d(p[14], p[17])

  // 대칭: 중심선(168-152)에서 좌우 대응점 거리 비교
  const pairs: [number, number][] = [
    [234, 454], [33, 263], [133, 362], [61, 291], [172, 397], [70, 300], [129, 358], [50, 280],
  ]
  const a = p[168]
  const b = chin
  const len = d(a, b)
  const signed = (q: P) => ((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / len
  let asym = 0
  for (const [l, r] of pairs) {
    const dl = Math.abs(signed(p[l]))
    const dr = Math.abs(signed(p[r]))
    asym += Math.abs(dl - dr) / ((dl + dr) / 2 + 1e-6)
  }
  asym /= pairs.length
  const symmetry = Math.max(0, Math.min(100, 100 - asym * 260))

  return {
    faceRatio: faceH / faceW,
    foreheadRatio: d(p[54], p[284]) / faceW,
    jawRatio: d(p[172], p[397]) / faceW,
    eyeOpen: (eyeHL / eyeWL + eyeHR / eyeWR) / 2,
    eyeGap: d(p[133], p[362]) / eyeW,
    noseRatio: d(p[129], p[358]) / faceW,
    mouthRatio: mouthW / faceW,
    lipRatio: lipH / mouthW,
    upper: upperRaw / tot,
    middle: middleRaw / tot,
    lower: lowerRaw / tot,
    symmetry,
  }
}

/** 여러 프레임의 중앙값 */
export function medianMetrics(list: FaceMetrics[]): FaceMetrics {
  const keys = Object.keys(list[0]) as (keyof FaceMetrics)[]
  const out = {} as FaceMetrics
  for (const k of keys) {
    const v = list.map((m) => m[k]).sort((x, y) => x - y)
    out[k] = v[Math.floor(v.length / 2)]
  }
  return out
}

/** 촬영 품질: 정면 여부, 거리, 중앙 정렬 */
export interface Quality {
  ok: boolean
  message: string
  size: number
  yaw: number
}

export function assessQuality(lm: NormalizedLandmark[], w: number, h: number): Quality {
  const p = toPx(lm, w, h)
  const faceW = d(p[234], p[454])
  const size = faceW / Math.min(w, h)
  const left = d(p[1], p[234])
  const right = d(p[1], p[454])
  const yaw = (left - right) / (left + right) // -1..1
  const c = mid(p[234], p[454])
  const offX = (c.x - w / 2) / w
  const offY = (mid(p[10], p[152]).y - h / 2) / h
  const tilt = Math.abs(Math.atan2(p[263].y - p[33].y, p[263].x - p[33].x)) * (180 / Math.PI)

  let message = '좋습니다. 그대로 정면을 바라봐 주세요'
  let ok = true
  if (size < 0.28) { ok = false; message = '조금 더 가까이 다가와 주세요' }
  else if (size > 0.78) { ok = false; message = '조금 뒤로 물러나 주세요' }
  else if (Math.abs(offX) > 0.14 || Math.abs(offY) > 0.16) { ok = false; message = '얼굴을 가이드 중앙에 맞춰 주세요' }
  else if (Math.abs(yaw) > 0.14) { ok = false; message = '고개를 돌리지 말고 정면을 봐 주세요' }
  else if (Math.min(tilt, 180 - tilt) > 8) { ok = false; message = '고개를 기울이지 말고 똑바로 해 주세요' }
  return { ok, message, size, yaw }
}

/** 면색(面色) 샘플링: 양 볼 영역 평균 색 */
export interface SkinTone {
  rgb: [number, number, number]
  lab: [number, number, number]
  color: '赤' | '黃' | '白' | '靑' | '黑'
  name: string
  organ: string
  desc: string
}

function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const f = (c: number) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const R = f(r), G = f(g), B = f(b)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const g3 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * g3(Y) - 16, 500 * (g3(X) - g3(Y)), 200 * (g3(Y) - g3(Z))]
}

export function sampleSkin(
  video: HTMLVideoElement,
  lm: NormalizedLandmark[],
  scratch: HTMLCanvasElement,
): [number, number, number] | null {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null
  scratch.width = w
  scratch.height = h
  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  const pts = [50, 280, 101, 330, 205, 425]
  const r = Math.max(4, Math.round(w * 0.012))
  let R = 0, G = 0, B = 0, n = 0
  for (const i of pts) {
    const x = Math.round(lm[i].x * w)
    const y = Math.round(lm[i].y * h)
    const data = ctx.getImageData(x - r, y - r, r * 2, r * 2).data
    for (let k = 0; k < data.length; k += 4) {
      R += data[k]; G += data[k + 1]; B += data[k + 2]; n++
    }
  }
  return n ? [R / n, G / n, B / n] : null
}

export function classifySkin(rgb: [number, number, number]): SkinTone {
  const lab = srgbToLab(...rgb)
  const [L, A, Bv] = lab
  const hue = (Math.atan2(Bv, A) * 180) / Math.PI // 피부: 보통 40~70
  const chroma = Math.hypot(A, Bv)
  let color: SkinTone['color']
  if (L < 38) color = '黑'
  else if (chroma < 14 && L > 62) color = '白'
  else if (hue < 46 && A > 14) color = '赤'
  else if (hue > 62) color = '黃'
  else if (A < 9) color = '靑'
  else color = L > 64 ? '白' : '黃'

  const table: Record<SkinTone['color'], { name: string; organ: string; desc: string }> = {
    赤: { name: '적색', organ: '心 · 火', desc: '혈색이 붉게 도는 편. 상부로 열이 오르기 쉬운 경향' },
    黃: { name: '황색', organ: '脾 · 土', desc: '누런 기가 도는 편. 소화기(비위) 상태를 살펴볼 필요' },
    白: { name: '백색', organ: '肺 · 金', desc: '희고 맑은 편. 기운과 혈색의 충실도를 살필 필요' },
    靑: { name: '청색', organ: '肝 · 木', desc: '푸르스름한 기가 있는 편. 순환·긴장 상태를 살필 필요' },
    黑: { name: '흑색', organ: '腎 · 水', desc: '어둡게 가라앉은 편. 피로 누적과 휴식 상태를 살필 필요' },
  }
  return { rgb, lab, color, ...table[color] }
}

/** 오행형(五行形) 얼굴형 분류 */
export interface FiveShape {
  key: '木' | '火' | '土' | '金' | '水'
  name: string
  desc: string
  scores: Record<'木' | '火' | '土' | '金' | '水', number>
}

export function classifyFiveShape(m: FaceMetrics): FiveShape {
  const z = (k: keyof typeof METRIC_INFO) => (m[k] - METRIC_INFO[k].mean) / METRIC_INFO[k].sd
  const long = z('faceRatio')
  const jaw = z('jawRatio')
  const fore = z('foreheadRatio')
  const taper = fore - jaw // 위가 넓고 아래가 좁으면 +
  const s = {
    木: long * 1.1 - Math.abs(taper) * 0.3 - Math.max(0, jaw) * 0.4,
    火: taper * 0.9 + Math.max(0, -jaw) * 0.5 - Math.max(0, -long) * 0.3,
    土: -taper * 0.8 + Math.max(0, jaw) * 0.5 - long * 0.3,
    金: jaw * 0.6 + fore * 0.4 - Math.abs(long) * 0.4,
    水: -long * 1.0 - Math.abs(taper) * 0.3 + (z('lipRatio') + z('noseRatio')) * 0.15,
  }
  const key = (Object.keys(s) as FiveShape['key'][]).reduce((a, b) => (s[a] >= s[b] ? a : b))
  const info: Record<FiveShape['key'], { name: string; desc: string }> = {
    木: { name: '목형 (木形)', desc: '길고 곧은 얼굴. 위아래로 뻗는 기운, 사고형' },
    火: { name: '화형 (火形)', desc: '이마가 넓고 턱이 뾰족한 역삼각. 발산하는 기운, 열정형' },
    土: { name: '토형 (土形)', desc: '아래가 넓고 두툼한 얼굴. 받치고 모으는 기운, 안정형' },
    金: { name: '금형 (金形)', desc: '이마와 턱이 반듯한 사각. 단단하고 맺는 기운, 결단형' },
    水: { name: '수형 (水形)', desc: '둥글고 부드러운 얼굴. 스며들고 저장하는 기운, 유연형' },
  }
  return { key, ...info[key], scores: s }
}
