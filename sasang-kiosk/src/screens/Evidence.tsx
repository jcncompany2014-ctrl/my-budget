import { CONSTITUTIONS, type TypeKey } from '../data/constitutions'
import { QUESTIONS } from '../data/questions'
import type { Factor, Result } from '../lib/scoring'

const SRC_COLOR: Record<Factor['source'], string> = { 안면: '#cfaa62', 설문: '#5fb39a', 체격: '#8f9bd6' }

/** 판정 근거: 판정 체질을 지지/반대한 요인 상위 목록 */
export function Evidence({ factors, type, anim }: { factors: Factor[]; type: TypeKey; anim: boolean }) {
  const c = CONSTITUTIONS[type]
  const top = factors.slice(0, 9)
  const max = Math.max(...top.map((f) => Math.abs(f.value)), 0.01)
  const total = factors.reduce((t, f) => t + Math.abs(f.value), 0) || 1
  const pro = factors.filter((f) => f.value > 0).length
  const con = factors.filter((f) => f.value < 0).length
  return (
    <section className="panel sec">
      <div className="sec-h">
        <h2>판정 근거 <span className="hj">辨證 根據</span></h2>
        <span className="mono">TOP {top.length} / {factors.length} FACTORS</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 26 }}>
        <div className="ev-sum"><span>지지 요인</span><b className="num" style={{ color: c.color }}>{pro}</b></div>
        <div className="ev-sum"><span>반대 요인</span><b className="num">{con}</b></div>
        <div className="ev-sum" style={{ flex: 2 }}>
          <span>범례</span>
          <div style={{ display: 'flex', gap: 18, fontSize: 19, marginTop: 6 }}>
            {(Object.keys(SRC_COLOR) as Factor['source'][]).map((k) => (
              <span key={k}><i className="ev-dot" style={{ background: SRC_COLOR[k] }} />{k}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="ev-axis"><span>← {c.name} 반대</span><span>{c.name} 지지 →</span></div>
      {top.map((f, i) => {
        const w = (Math.abs(f.value) / max) * 50
        return (
          <div key={i} className="ev-row">
            <div className="ev-text">
              <div className="ev-label"><span className="ev-src" style={{ color: SRC_COLOR[f.source], borderColor: SRC_COLOR[f.source] + '88' }}>{f.source}</span>{f.label}</div>
              <div className="ev-detail">{f.detail}</div>
            </div>
            <div className="ev-bar">
              <i style={{
                left: f.value >= 0 ? '50%' : `${50 - (anim ? w : 0)}%`,
                width: `${anim ? w : 0}%`,
                background: f.value >= 0 ? c.color : 'rgba(239,232,218,0.35)',
              }} />
            </div>
            <div className="ev-val num" style={{ color: f.value >= 0 ? c.color : 'var(--ink-3)' }}>
              {f.value >= 0 ? '+' : '−'}{((Math.abs(f.value) / total) * 100).toFixed(1)}%
            </div>
          </div>
        )
      })}
      <p style={{ fontSize: 18, color: 'var(--ink-3)', marginTop: 20, lineHeight: 1.6 }}>
        기여도(%)는 전체 요인의 영향력 합 대비 각 요인이 {c.name} 판정을 지지(+)하거나 반대(−)한 비중입니다. 안면 지표는 표준 얼굴 대비 편차(σ), 설문은 선택지의 체질 배점을 기준으로 산출합니다.
      </p>
    </section>
  )
}

const REFS = [
  { t: '이제마(李濟馬), 『동의수세보원(東醫壽世保元)』, 1894', d: '사상체질의 분류, 장부 대소(臟腑大小), 성정(性情)론과 체질별 병증·양생 원칙' },
  { t: '『황제내경 영추(黃帝內經 靈樞)』 「음양이십오인(陰陽二十五人)」편', d: '얼굴·체형의 오행(木火土金水) 형상에 따른 인체 분류' },
  { t: '형상의학(形象醫學) — 지산 박인규', d: '얼굴의 형(形)과 색(色)으로 장부의 허실을 살피는 진단 체계, 삼정·오관·면색 해석' },
  { t: '한국한의학연구원 사상체질 진단 연구 (KS-15 등)', d: '안면 형상·체형·설문을 통합하는 체질 판별 접근 방식 참고' },
  { t: 'Google MediaPipe Face Landmarker', d: '단일 카메라 영상에서 478개 3D 안면 랜드마크를 실시간 추정하는 기계학습 모델' },
  { t: '대한비만학회 비만 진료지침 (아시아-태평양 BMI 기준)', d: '정상 18.5–22.9 · 과체중 23–24.9 · 비만 25 이상' },
]

/** 분석 방법론 + 이론적 근거 */
export function Methodology({ result, hasFace }: { result: Result; hasFace: boolean }) {
  const W = result.weights
  const pipes = [
    { n: '01', t: '안면 형상', h: '形', w: W.face, lines: ['478 랜드마크 추출', '12개 비율 지표 산출', '표준 얼굴 대비 표준점수(z)', '체질별 형상 가중합'], off: !hasFace },
    { n: '02', t: '체질 설문', h: '證', w: W.survey, lines: [`${QUESTIONS.length}문항 · 6개 영역`, '체형 · 성정 · 소화', '한열 · 형색 · 생활', '선택지별 체질 배점 합산'] },
    { n: '03', t: '체격 지표', h: '體', w: W.body, lines: ['신장 · 체중 → BMI', '아시아-태평양 기준', '체질별 체격 경향 반영', ''] },
  ]
  return (
    <section className="panel sec">
      <div className="sec-h">
        <h2>분석 방법론 <span className="hj">分析 方法</span></h2>
        <span className="mono">MULTIMODAL · RULE-BASED</span>
      </div>
      <div className="mt-pipes">
        {pipes.map((p) => (
          <div key={p.n} className="mt-pipe" style={p.off ? { opacity: 0.4 } : undefined}>
            <div className="mt-head">
              <span className="mono">{p.n}</span>
              <span className="serif mt-h">{p.h}</span>
            </div>
            <div className="mt-title">{p.t}</div>
            <div className="mt-w num">{Math.round(p.w * 100)}<small>%</small></div>
            <ul>{p.lines.filter(Boolean).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mt-arrow">▼</div>
      <div className="mt-merge">
        <div>
          <div className="mt-title" style={{ fontSize: 24 }}>가중 혼합 · 유병률 사전확률 보정</div>
          <div style={{ fontSize: 19, color: 'var(--ink-3)', marginTop: 6 }}>태음 50% · 소양 30% · 소음 20% · 태양 극소수의 알려진 분포 반영</div>
        </div>
        <div className="mt-formula serif">P(t) ∝ π<sub>t</sub> · Σ w<sub>i</sub> P<sub>i</sub>(t)</div>
      </div>

      <div className="sub-h" style={{ marginTop: 40 }}>이론적 근거 · 참고 문헌</div>
      <ol className="refs">
        {REFS.map((r) => (
          <li key={r.t}>
            <div className="ref-t">{r.t}</div>
            <div className="ref-d">{r.d}</div>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: 17, color: 'var(--ink-3)', marginTop: 20, lineHeight: 1.6 }}>
        본 시스템은 위 문헌의 체질별 형상·증상 기술을 정량 지표와 배점으로 옮긴 규칙 기반 모델로, 임상 진단 도구로 검증된 것이 아닙니다.
      </p>
    </section>
  )
}
