import { useState } from 'react'
import { FooterNote, Icon, SasangOrb, Steps, TopBar } from '../components/ui'
import type { Profile } from '../lib/scoring'

export function Attract({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen attract" onPointerDown={onStart}>
      <div className="orb">
        <SasangOrb size={760} />
      </div>
      <h1>
        <small>四象體質 · 形象醫學</small>
        나의 체질을
        <br />
        얼굴과 몸으로 읽다
      </h1>
      <p>
        AI 안면 형상 측정 · 체질 설문 · 체격 지표를 종합하여
        <br />
        사상체질과 형상 특성을 분석합니다
      </p>
      <div className="tap-hint">
        {Icon.touch(40)} 화면을 터치하여 시작
      </div>
      <div className="attract-meta">
        <span>소요시간 <b>약 3분</b></span>
        <span>·</span>
        <span>안면 지표 <b>478 포인트</b></span>
        <span>·</span>
        <span>영상 <b>저장 안 함</b></span>
      </div>
    </div>
  )
}

export function Consent({ onNext, onBack, sessionId }: { onNext: () => void; onBack: () => void; sessionId: string }) {
  const [agree, setAgree] = useState(false)
  const items = [
    { ico: Icon.camera(), t: '안면 형상 촬영', d: '카메라로 얼굴의 비율·윤곽·면색을 측정합니다. 영상은 이 기기에서만 실시간 분석되며 저장되거나 외부로 전송되지 않습니다.' },
    { ico: Icon.clock(), t: '체질 설문 18문항', d: '체형·성정·소화·한열·생활 습관에 대한 간단한 설문입니다. 평소 자신의 모습을 기준으로 답해 주세요.' },
    { ico: Icon.info(), t: '참고용 건강 정보', d: '결과는 사상의학·형상의학 이론에 근거한 참고 정보이며 의학적 진단이 아닙니다. 정확한 체질 진단은 한의사와 상담하세요.' },
  ]
  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <Steps current={0} progress={agree ? 1 : 0.4} />
      <div className="content">
        <div className="eyebrow">STEP 01 · CONSENT</div>
        <h2 className="title">분석을 시작하기 전에<br />확인해 주세요</h2>
        <div className="check-list">
          {items.map((it) => (
            <div key={it.t} className="panel check-item">
              <div className="ico">{it.ico}</div>
              <div>
                <h3>{it.t}</h3>
                <p>{it.d}</p>
              </div>
            </div>
          ))}
        </div>
        <button className={`panel agree ${agree ? 'on' : ''}`} onClick={() => setAgree(!agree)}>
          <span className="box">{agree && Icon.check(30)}</span>
          위 내용을 확인했으며 안면 촬영 및 분석에 동의합니다
        </button>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={onBack}>{Icon.back()} 처음으로</button>
          <button className="btn btn-primary" disabled={!agree} onClick={onNext}>동의하고 시작 {Icon.arrow()}</button>
        </div>
      </div>
      <FooterNote />
    </div>
  )
}

function Stepper({ value, onChange, min, max, step = 1, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)))
  return (
    <>
      <div className="stepper">
        <button onClick={() => set(value - step)}>−</button>
        <div className="val num">{value}<small>{unit}</small></div>
        <button onClick={() => set(value + step)}>+</button>
      </div>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </>
  )
}

export function ProfileScreen({ profile, setProfile, onNext, onBack, sessionId }: {
  profile: Profile; setProfile: (p: Profile) => void; onNext: () => void; onBack: () => void; sessionId: string
}) {
  const bmi = profile.weight / (profile.height / 100) ** 2
  const bmiLabel = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만'
  const bmiPos = Math.min(100, Math.max(0, ((bmi - 15) / 20) * 100))
  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <Steps current={1} />
      <div className="content">
        <div className="eyebrow">STEP 02 · PROFILE</div>
        <h2 className="title">기본 정보를 입력해 주세요</h2>
        <div className="field">
          <div className="field-label">성별</div>
          <div className="seg">
            <button className={profile.sex === 'M' ? 'on' : ''} onClick={() => setProfile({ ...profile, sex: 'M' })}>남성</button>
            <button className={profile.sex === 'F' ? 'on' : ''} onClick={() => setProfile({ ...profile, sex: 'F' })}>여성</button>
          </div>
        </div>
        <div className="field">
          <div className="field-label">나이</div>
          <Stepper value={profile.age} min={10} max={95} unit="세" onChange={(age) => setProfile({ ...profile, age })} />
        </div>
        <div className="field">
          <div className="field-label">키</div>
          <Stepper value={profile.height} min={130} max={210} unit="cm" onChange={(height) => setProfile({ ...profile, height })} />
        </div>
        <div className="field">
          <div className="field-label">몸무게</div>
          <Stepper value={profile.weight} min={30} max={150} unit="kg" onChange={(weight) => setProfile({ ...profile, weight })} />
        </div>
        <div className="panel bmi-card">
          <div>
            <div style={{ fontSize: 20, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>체질량지수 BMI</div>
            <div className="num" style={{ fontSize: 56, fontWeight: 800, marginTop: 4 }}>{bmi.toFixed(1)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: 'var(--ink-3)' }}>
              <span>저체중</span><span>정상</span><span>과체중</span><span>비만</span>
            </div>
            <div style={{ position: 'relative', height: 14, borderRadius: 7, marginTop: 12, background: 'linear-gradient(90deg,#5e86cf,#5fb39a 35%,#e3a93c 55%,#c8553d)' }}>
              <i style={{ position: 'absolute', left: `${bmiPos}%`, top: -9, width: 32, height: 32, marginLeft: -16, borderRadius: '50%', background: '#efe8da', border: '5px solid #0a100f', transition: 'left .3s' }} />
            </div>
            <div style={{ marginTop: 16, fontSize: 24, fontWeight: 600 }}>{bmiLabel}</div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={onBack}>{Icon.back()} 이전</button>
          <button className="btn btn-primary" onClick={onNext}>안면 촬영으로 {Icon.arrow()}</button>
        </div>
      </div>
      <FooterNote />
    </div>
  )
}
