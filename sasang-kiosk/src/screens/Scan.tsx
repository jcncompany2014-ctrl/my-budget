import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FooterNote, Icon, Steps, TopBar } from '../components/ui'
import {
  FaceLandmarker, assessQuality, classifySkin, computeMetrics, getLandmarker, medianMetrics, sampleSkin,
  type FaceMetrics, type SkinTone,
} from '../lib/face'

export interface ScanResult {
  metrics: FaceMetrics
  skin: SkinTone | null
  snapshot: string
  landmarks: NormalizedLandmark[]
}

type Phase = 'loading' | 'error' | 'searching' | 'aligning' | 'scanning' | 'done'

const CW = 952
const CH = 1080
const DPR = 1.5
const SCAN_MS = 4200

const params = new URLSearchParams(location.search)
const MIRROR = params.get('mirror') !== '0'

export function Scan({ onNext, onBack, onSkip, sessionId }: {
  onNext: (r: ScanResult) => void; onBack: () => void; onSkip: () => void; sessionId: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('AI 형상 분석 모델을 불러오는 중…')
  const [progress, setProgress] = useState(0)
  const [live, setLive] = useState<FaceMetrics | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let raf = 0
    let stream: MediaStream | null = null
    let cancelled = false
    const samples: FaceMetrics[] = []
    const skins: [number, number, number][] = []
    const scratch = document.createElement('canvas')
    let prog = 0
    let last = performance.now()
    let lastTs = 0
    let frame = 0
    let phaseLocal: Phase = 'loading'
    const setP = (p: Phase) => { if (phaseLocal !== p) { phaseLocal = p; setPhase(p) } }

    setProgress(0)
    setResult(null)
    setLive(null)

    ;(async () => {
      try {
        const [lmk, s] = await Promise.all([
          getLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false,
          }),
        ])
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = s
        await video.play()
        videoRef.current = video
        setP('searching')
        setMessage('얼굴을 화면 중앙의 가이드에 맞춰 주세요')
        loop(lmk, video)
      } catch (e) {
        console.error(e)
        if (cancelled) return
        setP('error')
        setMessage('카메라를 사용할 수 없습니다. 연결 상태와 권한을 확인해 주세요.')
      }
    })()

    function loop(lmk: FaceLandmarker, video: HTMLVideoElement) {
      const cv = canvasRef.current
      if (!cv || cancelled) return
      const ctx = cv.getContext('2d')!
      const now = performance.now()
      const dt = now - last
      last = now
      frame++

      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) { raf = requestAnimationFrame(() => loop(lmk, video)); return }

      // cover crop
      const ca = CW / CH
      const va = vw / vh
      let sw = vw, sh = vh, sx = 0, sy = 0
      if (va > ca) { sw = vh * ca; sx = (vw - sw) / 2 } else { sh = vw / ca; sy = (vh - sh) / 2 }
      const map = (p: NormalizedLandmark) => {
        let x = ((p.x * vw - sx) / sw) * CW
        const y = ((p.y * vh - sy) / sh) * CH
        if (MIRROR) x = CW - x
        return [x, y] as const
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ctx.save()
      if (MIRROR) { ctx.translate(CW, 0); ctx.scale(-1, 1) }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CW, CH)
      ctx.restore()

      let lm: NormalizedLandmark[] | null = null
      if (phaseLocal !== 'done') {
        const ts = Math.max(lastTs + 1, now)
        lastTs = ts
        const res = lmk.detectForVideo(video, ts)
        lm = res.faceLandmarks?.[0] ?? null
      }

      // 가이드 바깥 어둡게
      const gx = CW / 2, gy = CH * 0.46, grx = CW * 0.3, gry = CH * 0.34
      ctx.save()
      ctx.fillStyle = 'rgba(5,8,7,0.55)'
      ctx.beginPath()
      ctx.rect(0, 0, CW, CH)
      ctx.ellipse(gx, gy, grx, gry, 0, 0, Math.PI * 2)
      ctx.fill('evenodd')
      ctx.restore()

      let ok = false
      if (lm) {
        const q = assessQuality(lm, vw, vh)
        ok = q.ok
        if (phaseLocal === 'searching' || phaseLocal === 'aligning' || phaseLocal === 'scanning') {
          if (ok) {
            setP('scanning')
            setMessage('측정 중입니다. 움직이지 말고 정면을 바라봐 주세요')
          } else {
            if (phaseLocal !== 'scanning' || prog < 0.02) setP('aligning')
            setMessage(q.message)
          }
        }
        drawFace(ctx, lm, map, now, ok, prog)
        if (ok && phaseLocal === 'scanning') {
          const m = computeMetrics(lm, vw, vh)
          samples.push(m)
          if (frame % 6 === 0) {
            const s = sampleSkin(video, lm, scratch)
            if (s) skins.push(s)
          }
          if (frame % 8 === 0) setLive(medianMetrics(samples.slice(-15)))
          prog = Math.min(1, prog + dt / SCAN_MS)
          setProgress(prog)
        }
      } else if (phaseLocal !== 'loading' && phaseLocal !== 'done') {
        setP('searching')
        setMessage('얼굴이 감지되지 않습니다. 가이드 안으로 들어와 주세요')
      }

      drawGuide(ctx, gx, gy, grx, gry, ok, now)

      if (prog >= 1 && phaseLocal === 'scanning' && lm) {
        const metrics = medianMetrics(samples.slice(-120))
        let skin: SkinTone | null = null
        if (skins.length) {
          const avg = skins.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]).map((v) => v / skins.length) as [number, number, number]
          skin = classifySkin(avg)
        }
        const snapshot = cv.toDataURL('image/jpeg', 0.85)
        setResult({ metrics, skin, snapshot, landmarks: lm })
        setLive(metrics)
        setP('done')
        setMessage('측정이 완료되었습니다')
        stream?.getTracks().forEach((t) => t.stop())
        return
      }
      raf = requestAnimationFrame(() => loop(lmk, video))
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt])

  const fmt = (v: number | undefined, d = 2) => (v == null ? '—' : v.toFixed(d))
  const reads = [
    { k: '안면 종횡비', h: '面長', v: fmt(live?.faceRatio) },
    { k: '턱/광대', h: '頤廣', v: fmt(live?.jawRatio) },
    { k: '눈 개폐도', h: '目', v: fmt(live?.eyeOpen) },
    { k: '좌우 대칭', h: '均衡', v: live ? `${live.symmetry.toFixed(0)}%` : '—' },
  ]

  return (
    <div className="screen">
      <TopBar sessionId={sessionId} />
      <Steps current={2} progress={phase === 'done' ? 1 : progress} />
      <div className="content" style={{ paddingTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div className="eyebrow">STEP 03 · FACIAL MORPHOLOGY</div>
            <h2 className="title" style={{ fontSize: 48, marginTop: 10 }}>안면 형상 측정</h2>
          </div>
          <div className="num" style={{ fontSize: 64, fontWeight: 800, color: phase === 'done' ? 'var(--jade)' : 'var(--gold-2)' }}>
            {Math.round((phase === 'done' ? 1 : progress) * 100)}<span style={{ fontSize: 30, color: 'var(--ink-3)' }}>%</span>
          </div>
        </div>
        <div className="scan-wrap">
          <canvas ref={canvasRef} width={CW * DPR} height={CH * DPR} />
          <div className="scan-hud">
            <div className="scan-progress mono">
              <span>FACE MESH 478PT · {MIRROR ? 'MIRROR' : 'RAW'}</span>
              <span>{phase.toUpperCase()}</span>
            </div>
            {phase === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div className="an-item on" style={{ fontSize: 28 }}><span className="st" /> 모델 초기화 중</div>
              </div>
            )}
            <div className="scan-status">
              <span className={`dot ${phase === 'scanning' || phase === 'done' ? 'ok' : ''}`} />
              {message}
            </div>
          </div>
        </div>
        <div className="readouts">
          {reads.map((r) => (
            <div key={r.k} className="readout">
              <div className="k"><span>{r.k}</span><span className="serif">{r.h}</span></div>
              <div className="v num">{r.v}</div>
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ paddingTop: 24 }}>
          {phase === 'error' ? (
            <>
              <button className="btn btn-ghost" onClick={() => setAttempt((a) => a + 1)}>다시 시도</button>
              <button className="btn btn-primary" onClick={onSkip}>설문으로만 진행 {Icon.arrow()}</button>
            </>
          ) : phase === 'done' ? (
            <>
              <button className="btn btn-ghost" onClick={() => setAttempt((a) => a + 1)}>다시 촬영</button>
              <button className="btn btn-primary" onClick={() => result && onNext(result)}>체질 설문으로 {Icon.arrow()}</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onBack}>{Icon.back()} 이전</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onSkip}>촬영 건너뛰기</button>
            </>
          )}
        </div>
      </div>
      <FooterNote />
    </div>
  )
}

type Mapper = (p: NormalizedLandmark) => readonly [number, number]

function drawPath(ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], map: Mapper, conns: { start: number; end: number }[]) {
  ctx.beginPath()
  for (const c of conns) {
    const [x0, y0] = map(lm[c.start])
    const [x1, y1] = map(lm[c.end])
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
  }
  ctx.stroke()
}

function drawFace(ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], map: Mapper, now: number, ok: boolean, prog: number) {
  ctx.save()
  ctx.lineWidth = 0.6
  ctx.strokeStyle = ok ? 'rgba(95,179,154,0.28)' : 'rgba(239,232,218,0.16)'
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_TESSELATION)

  ctx.lineWidth = 1.6
  ctx.strokeStyle = ok ? 'rgba(233,207,147,0.9)' : 'rgba(239,232,218,0.5)'
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL)
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_LIPS)
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE)
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE)
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW)
  drawPath(ctx, lm, map, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW)

  if (ok) {
    // 측정선
    const line = (a: number, b: number, label: string, color = 'rgba(207,170,98,0.95)') => {
      const [x0, y0] = map(lm[a])
      const [x1, y1] = map(lm[b])
      ctx.strokeStyle = color
      ctx.lineWidth = 1.4
      ctx.setLineDash([6, 5])
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
      ctx.setLineDash([])
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      }
      ctx.font = '600 15px Pretendard Variable, sans-serif'
      ctx.fillStyle = 'rgba(239,232,218,0.95)'
      const tx = Math.max(x0, x1) + 10
      ctx.fillText(label, tx, (y0 + y1) / 2 + 5)
    }
    line(54, 284, '額')
    line(234, 454, '顴')
    line(172, 397, '頤')
    line(10, 152, '', 'rgba(95,179,154,0.7)')
    // 삼정 수평선
    const [, by] = map(lm[9])
    const [, ny] = map(lm[2])
    const [lx] = map(lm[234])
    const [rx] = map(lm[454])
    const xl = Math.min(lx, rx) - 30
    const xr = Math.max(lx, rx) + 30
    ctx.strokeStyle = 'rgba(95,179,154,0.55)'
    ctx.lineWidth = 1
    for (const y of [by, ny]) { ctx.beginPath(); ctx.moveTo(xl, y); ctx.lineTo(xr, y); ctx.stroke() }

    // 스캔 라인
    const [, ty] = map(lm[10])
    const [, cy] = map(lm[152])
    const sy = ty + ((Math.sin(now / 380) + 1) / 2) * (cy - ty)
    const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 2)
    g.addColorStop(0, 'rgba(95,179,154,0)')
    g.addColorStop(1, 'rgba(95,179,154,0.55)')
    ctx.fillStyle = g
    ctx.fillRect(xl, sy - 30, xr - xl, 32)
    ctx.fillStyle = 'rgba(160,240,210,0.9)'
    ctx.fillRect(xl, sy, xr - xl, 1.5)

    // 랜드마크 점 일부 반짝임
    const n = Math.floor(prog * 478)
    ctx.fillStyle = 'rgba(233,207,147,0.85)'
    for (let i = 0; i < n; i += 7) {
      const [x, y] = map(lm[i])
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4)
    }
  }
  ctx.restore()
}

function drawGuide(ctx: CanvasRenderingContext2D, gx: number, gy: number, rx: number, ry: number, ok: boolean, now: number) {
  ctx.save()
  ctx.strokeStyle = ok ? 'rgba(95,179,154,0.95)' : 'rgba(233,207,147,0.85)'
  ctx.lineWidth = 3
  ctx.setLineDash([14, 12])
  ctx.lineDashOffset = -now / 40
  ctx.beginPath()
  ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // 코너 브라켓
  const m = 40, L = 60
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(233,207,147,0.9)'
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1], [CW - m, m, -1, 1], [m, CH - m - 90, 1, -1], [CW - m, CH - m - 90, -1, -1],
  ]
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke()
  }
  // 십자 기준선
  ctx.strokeStyle = 'rgba(239,232,218,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(gx, gy - ry - 20); ctx.lineTo(gx, gy + ry + 20); ctx.stroke()
  ctx.restore()
}
