import { useEffect, useRef, useState } from 'react'
import { FooterNote, Icon, Steps, TopBar } from '../components/ui'
import { QUESTIONS } from '../data/questions'

const KEYS = ['甲', '乙', '丙', '丁']

export function Survey({ answers, setAnswers, onDone, onBack, sessionId }: {
  answers: Record<string, number>
  setAnswers: (a: Record<string, number>) => void
  onDone: () => void
  onBack: () => void
  sessionId: string
}) {
  const [idx, setIdx] = useState(0)
  const timer = useRef<number | null>(null)
  const q = QUESTIONS[idx]
  const sel = answers[q.id]

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const choose = (i: number) => {
    if (timer.current) return
    setAnswers({ ...answers, [q.id]: i })
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (idx < QUESTIONS.length - 1) setIdx(idx + 1)
      else onDone()
    }, 320)
  }

  const prev = () => (idx === 0 ? onBack() : setIdx(idx - 1))

  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <Steps current={3} progress={(idx + (sel != null ? 1 : 0)) / QUESTIONS.length} />
      <div className="content">
        <div className="q-head">
          <div className="q-cat">
            <span className="tag">{q.category}</span>
            <span className="hanja">{q.categoryHanja}</span>
          </div>
          <div className="q-count num"><b>{String(idx + 1).padStart(2, '0')}</b> / {QUESTIONS.length}</div>
        </div>
        <h2 className="q-text" key={q.id + 't'} style={{ animation: 'fadeIn .4s both' }}>{q.text}</h2>
        <div className="opts" key={q.id}>
          {q.options.map((o, i) => (
            <button key={i} className={`opt ${sel === i ? 'on' : ''}`} style={{ animationDelay: `${i * 50}ms` }} onClick={() => choose(i)}>
              <span className="key">{KEYS[i]}</span>
              <span>
                <div className="lbl">{o.label}</div>
                {o.sub && <div className="sub">{o.sub}</div>}
              </span>
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={prev}>{Icon.back()} 이전</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {QUESTIONS.map((qq, i) => (
              <span key={qq.id} style={{
                width: i === idx ? 34 : 12, height: 12, borderRadius: 6, transition: '.3s',
                background: i === idx ? 'var(--gold)' : answers[qq.id] != null ? 'var(--jade)' : 'rgba(255,255,255,0.12)',
              }} />
            ))}
          </div>
        </div>
      </div>
      <FooterNote />
    </div>
  )
}
