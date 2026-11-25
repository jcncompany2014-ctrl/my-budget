import { useEffect, useState } from 'react'
import { Icon, SasangOrb, TopBar } from '../components/ui'

const STEPS = [
  { t: '안면 형상 지표 표준화', c: 'FACE · Z-SCORE' },
  { t: '오행형 얼굴 분류 · 면색 판독', c: 'FIVE-PHASE' },
  { t: '성정·소화·한열 설문 분석', c: 'QUESTIONNAIRE' },
  { t: '체격 지표(BMI) 반영', c: 'BODY INDEX' },
  { t: '장부 대소 추정 · 체질 확률 산출', c: 'BAYES MIX' },
]

export function Analyzing({ onDone, sessionId, hasFace }: { onDone: () => void; sessionId: string; hasFace: boolean }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (i >= STEPS.length) {
      const t = setTimeout(onDone, 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setI(i + 1), 720)
    return () => clearTimeout(t)
  }, [i, onDone])

  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <div className="content analyzing">
        <SasangOrb size={520} />
        <div className="eyebrow" style={{ marginTop: 60 }}>ANALYZING</div>
        <h2 className="title" style={{ fontSize: 56 }}>체질을 분석하고 있습니다</h2>
        <div className="an-list">
          {STEPS.map((s, k) => {
            const skipped = !hasFace && k < 2
            return (
              <div key={s.t} className={`an-item ${k < i ? 'done' : k === i ? 'on' : ''}`} style={skipped ? { opacity: 0.4 } : undefined}>
                <span className="st">{k < i && Icon.check(24)}</span>
                {s.t}{skipped && ' (생략)'}
                <span className="mono">{s.c}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
