import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from './components/ui'
import { Attract, Consent, ProfileScreen } from './screens/Intro'
import { Scan, type ScanResult } from './screens/Scan'
import { Survey } from './screens/Survey'
import { Analyzing } from './screens/Analyzing'
import { Result } from './screens/Result'
import { computeResult, type Profile, type Result as R } from './lib/scoring'
import { getLandmarker } from './lib/face'

type Step = 'attract' | 'consent' | 'profile' | 'scan' | 'survey' | 'analyzing' | 'result'

const IDLE_SECONDS = 75
const WARN_SECONDS = 15
const DEFAULT_PROFILE: Profile = { sex: 'F', age: 35, height: 165, weight: 58 }

function newSessionId() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `SS-${d.getFullYear() % 100}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function App() {
  const [step, setStep] = useState<Step>('attract')
  const [sessionId, setSessionId] = useState(newSessionId)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<R | null>(null)
  const [idleLeft, setIdleLeft] = useState<number | null>(null)
  const lastTouch = useRef(Date.now())

  // 모델은 대기화면에서 미리 로드
  useEffect(() => { getLandmarker().catch(() => {}) }, [])

  const reset = useCallback(() => {
    setStep('attract')
    setSessionId(newSessionId())
    setProfile(DEFAULT_PROFILE)
    setScan(null)
    setAnswers({})
    setResult(null)
    setIdleLeft(null)
  }, [])

  // 무입력 타임아웃 (대기/결과 화면 제외 — 결과는 자체 타이머)
  useEffect(() => {
    const touch = () => { lastTouch.current = Date.now(); setIdleLeft(null) }
    window.addEventListener('pointerdown', touch)
    const t = setInterval(() => {
      if (step === 'attract' || step === 'result' || step === 'analyzing') return
      const idle = (Date.now() - lastTouch.current) / 1000
      if (idle > IDLE_SECONDS + WARN_SECONDS) reset()
      else if (idle > IDLE_SECONDS) setIdleLeft(Math.ceil(IDLE_SECONDS + WARN_SECONDS - idle))
    }, 500)
    return () => { clearInterval(t); window.removeEventListener('pointerdown', touch) }
  }, [step, reset])

  const start = () => {
    lastTouch.current = Date.now()
    document.documentElement.requestFullscreen?.().catch(() => {})
    setStep('consent')
  }

  const finish = useCallback(() => {
    setResult(computeResult(answers, profile, scan?.metrics ?? null))
    setStep('result')
  }, [answers, profile, scan])

  return (
    <Stage>
      {step === 'attract' && <Attract onStart={start} />}
      {step === 'consent' && <Consent sessionId={sessionId} onBack={reset} onNext={() => setStep('profile')} />}
      {step === 'profile' && (
        <ProfileScreen sessionId={sessionId} profile={profile} setProfile={setProfile} onBack={() => setStep('consent')} onNext={() => setStep('scan')} />
      )}
      {step === 'scan' && (
        <Scan
          sessionId={sessionId}
          onBack={() => setStep('profile')}
          onSkip={() => { setScan(null); setStep('survey') }}
          onNext={(r) => { setScan(r); setStep('survey') }}
        />
      )}
      {step === 'survey' && (
        <Survey sessionId={sessionId} answers={answers} setAnswers={setAnswers} onBack={() => setStep('scan')} onDone={() => setStep('analyzing')} />
      )}
      {step === 'analyzing' && <Analyzing sessionId={sessionId} hasFace={!!scan} onDone={finish} />}
      {step === 'result' && result && <Result sessionId={sessionId} result={result} scan={scan} profile={profile} onRestart={reset} />}

      {idleLeft != null && (
        <div className="modal-bg">
          <div className="panel modal">
            <h3>계속 진행하시겠어요?</h3>
            <div className="big num">{idleLeft}</div>
            <p>입력이 없어 곧 처음 화면으로 돌아갑니다.<br />입력하신 정보는 모두 삭제됩니다.</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setIdleLeft(null)}>계속하기</button>
          </div>
        </div>
      )}
    </Stage>
  )
}
