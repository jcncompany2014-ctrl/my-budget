import { useEffect, useState } from 'react'
import { CONSTITUTIONS, TYPE_KEYS } from '../data/constitutions'
import { OrganRadar, SasangOrb, TopBar } from '../components/ui'
import { METRIC_INFO, classifyFiveShape } from '../lib/face'
import { metricZ, type Profile, type Result as R } from '../lib/scoring'
import type { ScanResult } from './Scan'

const AUTO_RESET = 150

export function Result({ result, scan, profile, onRestart, sessionId }: {
  result: R; scan: ScanResult | null; profile: Profile; onRestart: () => void; sessionId: string
}) {
  const c = CONSTITUTIONS[result.primary]
  const c2 = CONSTITUTIONS[result.secondary]
  const [tab, setTab] = useState<'food' | 'move' | 'life'>('food')
  const [anim, setAnim] = useState(false)
  const [left, setLeft] = useState(AUTO_RESET)

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 80)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    const reset = () => setLeft(AUTO_RESET)
    window.addEventListener('pointerdown', reset)
    const t = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => { clearInterval(t); window.removeEventListener('pointerdown', reset) }
  }, [])
  useEffect(() => { if (left <= 0) onRestart() }, [left, onRestart])

  const sorted = [...TYPE_KEYS].sort((a, b) => result.final[b] - result.final[a])
  const pct = (v: number) => Math.round(v * 100)
  const shape = scan ? classifyFiveShape(scan.metrics) : null
  const m = scan?.metrics

  const dims = [
    { l: '한(寒)', r: '열(熱)', v: result.dims.heat },
    { l: '내향', r: '외향', v: result.dims.extro },
    { l: '소화 약', r: '소화 강', v: result.dims.digest },
    { l: '땀 적음', r: '땀 많음', v: result.dims.sweat },
  ]

  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <div className="result-scroll">
        {/* HERO */}
        <section className="panel r-hero" style={{ borderColor: c.color + '66', background: `linear-gradient(160deg, ${c.color}22, rgba(22,34,31,0.75) 55%)` }}>
          <div className="seal" style={{ opacity: anim ? 1 : 0, transition: 'opacity 1s' }}>
            <SasangOrb size={220} highlight={result.primary} />
          </div>
          <div className="eyebrow">분석 결과 · REPORT {sessionId}</div>
          <div className="r-type" style={{ color: c.color }}>
            {c.name}<span className="r-hanja">{c.hanja}</span>
          </div>
          <div className="r-organ" style={{ background: c.color + '22', color: c.color, border: `1px solid ${c.color}66` }}>
            <span className="serif">{c.organHanja}</span> {c.organ}
          </div>
          <p className="r-summary">{c.summary}</p>
          <div className="r-stats">
            <div className="r-stat"><div className="k">판정 일치도</div><div className="v num">{result.confidence}<small>%</small></div></div>
            <div className="r-stat"><div className="k">경향 체질 (2순위)</div><div className="v" style={{ color: c2.color, fontSize: 38 }}>{c2.name} <small className="num">{pct(result.final[result.secondary])}%</small></div></div>
            <div className="r-stat"><div className="k">BMI</div><div className="v num">{result.bmi.toFixed(1)}</div></div>
          </div>
        </section>

        {/* 확률 분포 */}
        <section className="panel sec">
          <div className="sec-h">
            <h2>체질 확률 분포 <span className="hj">四象 分布</span></h2>
            <span className="mono">
              설문 {Math.round(result.weights.survey * 100)} · 안면 {Math.round(result.weights.face * 100)} · 체격 {Math.round(result.weights.body * 100)}
            </span>
          </div>
          {sorted.map((k) => (
            <div key={k} className="prob-row">
              <div className="nm" style={{ color: k === result.primary ? CONSTITUTIONS[k].color : undefined }}>
                {CONSTITUTIONS[k].name}<small>{CONSTITUTIONS[k].hanja} · {CONSTITUTIONS[k].prevalence}</small>
              </div>
              <div className="prob-bar"><i style={{ width: anim ? `${result.final[k] * 100}%` : 0, background: CONSTITUTIONS[k].color }} /></div>
              <div className="pct num">{pct(result.final[k])}%</div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 26 }}>
            {([
              ['설문 분석', result.components.survey],
              ['안면 형상', result.components.face],
              ['체격 지표', result.components.body],
            ] as const).map(([label, d]) => (
              <div key={label} style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 18, color: 'var(--ink-3)' }}>{label}</div>
                {d ? (
                  <>
                    <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
                      {TYPE_KEYS.map((k) => <span key={k} style={{ width: `${d[k] * 100}%`, background: CONSTITUTIONS[k].color }} />)}
                    </div>
                    <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>
                      {CONSTITUTIONS[TYPE_KEYS.reduce((a, b) => (d[a] >= d[b] ? a : b))].name} 경향
                    </div>
                  </>
                ) : <div style={{ fontSize: 20, marginTop: 12, color: 'var(--ink-3)' }}>측정 생략</div>}
              </div>
            ))}
          </div>
        </section>

        {/* 장부 대소 + 성향 */}
        <section className="panel sec">
          <div className="sec-h">
            <h2>장부 대소 · 체질 성향 <span className="hj">臟腑 大小</span></h2>
            <span className="mono">50 = 평균</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 30, alignItems: 'center' }}>
            <OrganRadar values={result.organs} color={c.color} />
            <div>
              {dims.map((d) => (
                <div key={d.l} className="bipolar">
                  <span className="l">{d.l}</span>
                  <div className="track"><i style={{ left: anim ? `${50 + d.v * 46}%` : '50%' }} /></div>
                  <span className="r">{d.r}</span>
                </div>
              ))}
              <p style={{ fontSize: 21, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 20 }}>
                사상의학은 폐·비·간·신 네 장부 기능의 크고 작음(대소)으로 체질을 구분합니다.
                {' '}{c.name}은 <b style={{ color: c.color }}>{c.organ}</b>의 구조를 가집니다.
              </p>
            </div>
          </div>
        </section>

        {/* 안면 형상 */}
        {scan && m && shape && (
          <section className="panel sec">
            <div className="sec-h">
              <h2>안면 형상 분석 <span className="hj">形象 分析</span></h2>
              <span className="mono">478 LANDMARKS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 34 }}>
              <div>
                <div style={{ width: 360, height: 420, borderRadius: 24, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <img src={scan.snapshot} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 42%', transform: 'scale(1.35)' }} />
                </div>
                <div style={{ marginTop: 20, padding: '20px 22px', borderRadius: 18, background: 'rgba(207,170,98,0.1)', border: '1px solid rgba(207,170,98,0.4)' }}>
                  <div style={{ fontSize: 17, color: 'var(--ink-3)' }}>오행형 얼굴</div>
                  <div className="serif" style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold-2)', marginTop: 4 }}>{shape.name}</div>
                  <div style={{ fontSize: 19, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>{shape.desc}</div>
                </div>
              </div>
              <div className="metric-table">
                {(Object.keys(METRIC_INFO) as (keyof typeof METRIC_INFO)[]).map((k) => {
                  const z = metricZ(m, k)
                  const info = METRIC_INFO[k]
                  return (
                    <div key={k}>
                      <div className="mrow">
                        <span className="lbl">{info.label}<small>{info.hanja}</small></span>
                        <div className="mgauge"><i style={{ left: `${50 + (z / 3) * 46}%` }} /></div>
                        <span className="z num">{m[k].toFixed(2)}</span>
                      </div>
                      <div className="mrow" style={{ marginTop: -8 }}>
                        <span />
                        <div className="mgauge-ends"><span>{info.low}</span><span>{info.high}</span></div>
                        <span />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 30 }}>
              <div style={{ padding: '24px 26px', borderRadius: 20, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--line)' }}>
                <div className="sub-h">삼정 비율 三停</div>
                <div style={{ display: 'flex', height: 40, borderRadius: 10, overflow: 'hidden', fontSize: 17, fontWeight: 600 }}>
                  {([['상정', m.upper, '#5e86cf'], ['중정', m.middle, '#5fb39a'], ['하정', m.lower, '#cfaa62']] as const).map(([n, v, col]) => (
                    <span key={n} style={{ width: `${v * 100}%`, background: col + '55', display: 'grid', placeItems: 'center', borderRight: '1px solid #0a100f' }} className="num">
                      {n} {Math.round(v * 100)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 19, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.5 }}>
                  {zoneComment(m.upper, m.middle, m.lower)}
                </div>
                <div style={{ fontSize: 19, color: 'var(--ink-3)', marginTop: 10 }}>좌우 대칭도 <b className="num" style={{ color: 'var(--ink)' }}>{m.symmetry.toFixed(0)}%</b></div>
              </div>
              <div style={{ padding: '24px 26px', borderRadius: 20, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--line)' }}>
                <div className="sub-h">면색 판독 面色</div>
                {scan.skin ? (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{ width: 84, height: 84, borderRadius: 20, flex: 'none', background: `rgb(${scan.skin.rgb.map(Math.round).join(',')})`, border: '2px solid var(--line-strong)' }} />
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700 }}><span className="serif" style={{ color: 'var(--gold-2)' }}>{scan.skin.color}</span> {scan.skin.name} <small style={{ fontSize: 18, color: 'var(--ink-3)' }}>{scan.skin.organ}</small></div>
                      <div style={{ fontSize: 18, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>{scan.skin.desc}</div>
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--ink-3)', fontSize: 20 }}>측정되지 않음</div>}
                <div style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 12 }}>※ 조명 환경에 따라 달라질 수 있습니다</div>
              </div>
            </div>
          </section>
        )}

        {/* 특성 */}
        <section className="panel sec">
          <div className="sec-h"><h2>{c.name}의 특성 <span className="hj">體質 特性</span></h2></div>
          <div className="two-col">
            <div>
              <div className="sub-h">체형 · 외형</div>
              <ul className="bullets">{c.body.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <div className="sub-h">성품 · 장점</div>
              <ul className="bullets">{c.mind.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <div className="sub-h">마음가짐 주의</div>
              <ul className="bullets">{c.caution.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <div className="sub-h">건강 관리 포인트</div>
              <ul className="bullets">{c.weakPoints.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
          <div style={{ marginTop: 30, padding: '24px 28px', borderRadius: 20, background: c.color + '18', border: `1px solid ${c.color}55`, fontSize: 24 }}>
            <b style={{ color: c.color }}>건강 신호 ·</b> {c.healthSign}
          </div>
        </section>

        {/* 양생법 */}
        <section className="panel sec">
          <div className="sec-h"><h2>맞춤 양생법 <span className="hj">養生法</span></h2></div>
          <div className="tabs">
            <button className={tab === 'food' ? 'on' : ''} onClick={() => setTab('food')}>음식</button>
            <button className={tab === 'move' ? 'on' : ''} onClick={() => setTab('move')}>운동</button>
            <button className={tab === 'life' ? 'on' : ''} onClick={() => setTab('life')}>생활 습관</button>
          </div>
          {tab === 'food' && (
            <div className="two-col">
              <div><div className="sub-h" style={{ color: 'var(--jade)' }}>이로운 음식</div><div className="chip-list">{c.foodGood.map((f) => <span key={f} className="chip good">{f}</span>)}</div></div>
              <div><div className="sub-h" style={{ color: 'var(--cinnabar)' }}>줄일 음식</div><div className="chip-list">{c.foodAvoid.map((f) => <span key={f} className="chip bad">{f}</span>)}</div></div>
            </div>
          )}
          {tab === 'move' && <ul className="bullets">{c.exercise.map((t) => <li key={t}>{t}</li>)}</ul>}
          {tab === 'life' && <ul className="bullets">{c.lifestyle.map((t) => <li key={t}>{t}</li>)}</ul>}
        </section>

        <div className="disclaimer">
          {profile.sex === 'M' ? '남성' : '여성'} · {profile.age}세 · {profile.height}cm · {profile.weight}kg 기준 분석. 본 결과는 사상의학·형상의학 이론과 설문·안면 비율 측정을 종합한
          참고용 정보로, 의학적 진단이나 치료를 대신하지 않습니다. 체질은 한의사의 진찰(망·문·문·절)을 통해 정확히 판단할 수 있으며,
          건강상 이상이 있다면 의료기관을 방문하세요. 촬영 영상과 결과는 이 기기에 저장되지 않으며 화면 종료 시 삭제됩니다.
        </div>
      </div>
      <div className="r-footer">
        <button className="btn btn-primary" onClick={onRestart}>처음으로</button>
        <div className="count num">{left}초 후<br />자동 종료</div>
      </div>
    </div>
  )
}

function zoneComment(u: number, mi: number, l: number) {
  const max = Math.max(u, mi, l)
  if (max - Math.min(u, mi, l) < 0.04) return '세 부위가 고르게 균형 잡힌 형상입니다.'
  if (max === u) return '상정(이마)이 발달한 형상 — 사고·기획의 기운이 두드러집니다.'
  if (max === mi) return '중정(눈·코)이 발달한 형상 — 활동·실행의 기운이 두드러집니다.'
  return '하정(입·턱)이 발달한 형상 — 지구력·저장의 기운이 두드러집니다.'
}
