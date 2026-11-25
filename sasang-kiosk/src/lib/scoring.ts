import { ORGANS, ORGAN_EFFECT, TYPE_KEYS, type OrganKey, type TypeKey } from '../data/constitutions'
import { QUESTIONS, type Dim } from '../data/questions'
import { METRIC_INFO, type FaceMetrics } from './face'

export type Dist = Record<TypeKey, number>

export interface Profile {
  sex: 'M' | 'F'
  age: number
  height: number // cm
  weight: number // kg
}

const zero = (): Dist => ({ taeyang: 0, soyang: 0, taeeum: 0, soeum: 0 })

function normalize(d: Dist): Dist {
  const s = TYPE_KEYS.reduce((a, k) => a + Math.max(0, d[k]), 0) || 1
  const o = zero()
  for (const k of TYPE_KEYS) o[k] = Math.max(0, d[k]) / s
  return o
}

function softmax(d: Dist, temp = 1): Dist {
  const m = Math.max(...TYPE_KEYS.map((k) => d[k]))
  const o = zero()
  let s = 0
  for (const k of TYPE_KEYS) { o[k] = Math.exp((d[k] - m) / temp); s += o[k] }
  for (const k of TYPE_KEYS) o[k] /= s
  return o
}

/** 설문: 선택지 점수를 문항별 최대치 대비 비율로 누적 */
export function surveyScore(answers: Record<string, number>): { dist: Dist; dims: Record<Dim, number> } {
  const raw = zero()
  const dims: Record<Dim, number> = { heat: 0, extro: 0, digest: 0, sweat: 0 }
  const dimMax: Record<Dim, number> = { heat: 0, extro: 0, digest: 0, sweat: 0 }
  for (const q of QUESTIONS) {
    for (const dk of Object.keys(dimMax) as Dim[]) {
      dimMax[dk] += Math.max(0, ...q.options.map((o) => Math.abs(o.dim?.[dk] ?? 0)))
    }
    const idx = answers[q.id]
    if (idx == null) continue
    const opt = q.options[idx]
    for (const k of TYPE_KEYS) raw[k] += opt.score[k] ?? 0
    for (const dk of Object.keys(dims) as Dim[]) dims[dk] += opt.dim?.[dk] ?? 0
  }
  for (const dk of Object.keys(dims) as Dim[]) dims[dk] = dimMax[dk] ? dims[dk] / dimMax[dk] : 0 // -1..1
  // 점수 차이를 확률로: 온도는 문항 수에 비례
  return { dist: softmax(raw, 4.5), dims }
}

/** 안면 형상: 각 지표의 표준점수(z)에 체질별 가중치 */
const FACE_WEIGHTS: Record<TypeKey, Partial<Record<keyof FaceMetrics, number>>> = {
  taeyang: { foreheadRatio: 1.0, upper: 0.8, eyeOpen: 0.3, jawRatio: -0.4, lower: -0.4 },
  soyang: { jawRatio: -0.9, lipRatio: -0.6, foreheadRatio: 0.4, mouthRatio: -0.2, faceRatio: 0.2, eyeOpen: 0.2 },
  taeeum: { faceRatio: -0.9, jawRatio: 0.8, noseRatio: 0.8, lipRatio: 0.6, mouthRatio: 0.5, eyeOpen: 0.2 },
  soeum: { faceRatio: 0.5, noseRatio: -0.6, mouthRatio: -0.5, eyeOpen: -0.5, lower: 0.4, jawRatio: -0.3 },
}

const ZONE_REF = { upper: { mean: 0.33, sd: 0.03 }, middle: { mean: 0.34, sd: 0.025 }, lower: { mean: 0.33, sd: 0.03 } }

export function metricZ(m: FaceMetrics, k: keyof FaceMetrics): number {
  if (k in METRIC_INFO) {
    const r = METRIC_INFO[k as keyof typeof METRIC_INFO]
    return clamp((m[k] - r.mean) / r.sd, -3, 3)
  }
  if (k in ZONE_REF) {
    const r = ZONE_REF[k as keyof typeof ZONE_REF]
    return clamp((m[k] - r.mean) / r.sd, -3, 3)
  }
  return 0
}

export function faceScore(m: FaceMetrics): Dist {
  const raw = zero()
  for (const t of TYPE_KEYS) {
    for (const [k, w] of Object.entries(FACE_WEIGHTS[t])) raw[t] += w! * metricZ(m, k as keyof FaceMetrics)
  }
  return softmax(raw, 1.6)
}

/** 체격: BMI */
export function bodyScore(p: Profile): { dist: Dist; bmi: number } {
  const bmi = p.weight / (p.height / 100) ** 2
  const raw = zero()
  // 아시아 기준 BMI 구간
  raw.taeeum = clamp((bmi - 21.5) / 3, -1.5, 2)
  raw.soeum = clamp((20.5 - bmi) / 2.5, -1.5, 2)
  raw.soyang = 0.4 - Math.abs(bmi - 21.5) / 4
  raw.taeyang = 0.2 - Math.abs(bmi - 21.5) / 5
  return { dist: softmax(raw, 0.9), bmi }
}

// 일반적으로 알려진 체질 분포 (태양인은 매우 드묾)
const PRIOR: Dist = { taeyang: 0.35, soyang: 1.0, taeeum: 1.1, soeum: 1.0 }

export interface Result {
  final: Dist
  primary: TypeKey
  secondary: TypeKey
  confidence: number // 0~100
  components: { survey: Dist; face: Dist | null; body: Dist }
  weights: { survey: number; face: number; body: number }
  organs: Record<OrganKey, number> // 0~100
  dims: Record<Dim, number>
  bmi: number
}

export function computeResult(answers: Record<string, number>, profile: Profile, face: FaceMetrics | null): Result {
  const s = surveyScore(answers)
  const f = face ? faceScore(face) : null
  const b = bodyScore(profile)
  const weights = f ? { survey: 0.55, face: 0.3, body: 0.15 } : { survey: 0.78, face: 0, body: 0.22 }
  const mix = zero()
  for (const k of TYPE_KEYS) {
    mix[k] = (s.dist[k] * weights.survey + (f ? f[k] * weights.face : 0) + b.dist[k] * weights.body) * PRIOR[k]
  }
  const final = normalize(mix)
  const sorted = [...TYPE_KEYS].sort((a, z) => final[z] - final[a])
  const [p1, p2] = sorted
  const margin = final[p1] - final[p2]
  // 구성요소 간 일치도 + 1·2위 격차
  const agree = [s.dist, f, b.dist].filter(Boolean).filter((d) => topOf(d!) === p1).length / (f ? 3 : 2)
  const confidence = Math.round(clamp(45 + margin * 120 + agree * 25, 40, 97))

  const organs = {} as Record<OrganKey, number>
  for (const o of ORGANS) {
    let v = 0
    for (const k of TYPE_KEYS) v += final[k] * ORGAN_EFFECT[k][o.key]
    organs[o.key] = Math.round(50 + v * 42)
  }
  return {
    final,
    primary: p1,
    secondary: p2,
    confidence,
    components: { survey: s.dist, face: f, body: b.dist },
    weights,
    organs,
    dims: s.dims,
    bmi: b.bmi,
  }
}

function topOf(d: Dist): TypeKey {
  return TYPE_KEYS.reduce((a, b) => (d[a] >= d[b] ? a : b))
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
