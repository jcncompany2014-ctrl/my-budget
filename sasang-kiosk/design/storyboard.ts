// 스토리보드 러너: /design/storyboard.html?scene=S01&t=1.5  (또는 window.SB.render(id, t))
import '@fontsource/noto-serif-kr/200.css'
import '@fontsource/noto-serif-kr/400.css'
import '@fontsource/noto-serif-kr/900.css'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/cormorant-garamond/300-italic.css'
import '@fontsource/hahmlet/300.css'
import '@fontsource/hahmlet/700.css'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { clear, grain, resetPool, setCtx, type Scene } from './engine'
import { scenes as a1 } from './scenes/act1'
import { scenes as a2 } from './scenes/act2'
import { scenes as a3 } from './scenes/act3'
import { scenes as a4 } from './scenes/act4'
import { scenes as a5 } from './scenes/act5'
import { scenes as a6 } from './scenes/act6'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d', { willReadFrequently: false })!
setCtx(ctx)
const ALL: Scene[] = [...a1, ...a2, ...a3, ...a4, ...a5, ...a6]

let frameNo = 0
function render(id: string, t: number) {
  const s = ALL.find((x) => x.id === id)
  if (!s) throw new Error('no scene ' + id)
  resetPool()
  clear()
  s.render(Math.max(0, Math.min(s.dur, t)))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
  grain(9, frameNo++)
}

;(window as unknown as { SB: unknown }).SB = {
  list: () => ALL.map(({ id, act, title, note, dur }) => ({ id, act, title, note, dur })),
  render,
  jpeg: (q = 0.86) => cv.toDataURL('image/jpeg', q),
}

;(async () => {
  const sample = '太陽人少陽人太陰人少陰人觀形同意肺脾肝腎天人地上停中停下停判讀墨光儀禮 얼굴과몸으로읽는체질화면을터치하세요동의날인키몸무게나이성별측정판독중결과경향소양태음소음태양감사합니다 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 .:·—%°σ+-/'
  await Promise.all([
    `200 40px "Noto Serif KR"`, `400 40px "Noto Serif KR"`, `900 40px "Noto Serif KR"`, `300 20px "IBM Plex Mono"`, `400 20px "IBM Plex Mono"`,
    `italic 300 40px "Cormorant Garamond"`, `300 40px "Hahmlet"`, `700 40px "Hahmlet"`, `400 40px "Pretendard Variable"`, `500 40px "Pretendard Variable"`, `700 40px "Pretendard Variable"`,
  ].map((f) => document.fonts.load(f, sample)))
  const q = new URLSearchParams(location.search)
  const id = q.get('scene')
  if (id) render(id, Number(q.get('t') ?? 0))
  document.title = 'ready'
})()
