import { C, FONT, W, beam, dust, ease, hanji, header, seg, text, vignette, type Scene } from '../engine'

/** 공통 무대: 한지 창 위치 (모든 막에서 재사용) */
export const WIN = { x: 150, y: 200, w: 780, h: 1180 }

const S01: Scene = {
  id: 'S01',
  act: '대기',
  title: '암전, 그리고 창이 켜진다',
  note: '완전한 어둠에서 천장의 빛기둥이 내려와 한지 창을 깨운다. 먼지가 빛 속을 떠다닌다.',
  dur: 4,
  render(t) {
    const kBeam = ease.sine(seg(t, 0.3, 2.4))
    const kWin = ease.sine(seg(t, 1.4, 3.8))
    // 빛기둥(A): 창 위에서 떨어진다
    beam(W / 2, 200, 820, WIN.y + 120, kBeam * 0.9)
    dust(W / 2, 200, 820, WIN.y + 120, 900, t, 5, '255,214,150', kBeam)
    // 한지 창(B)
    hanji(WIN.x, WIN.y, WIN.w, WIN.h, kWin * 0.92)
    header('墨光判讀室 · INK-LIGHT READING ROOM', 'STANDBY', seg(t, 2.6, 3.8))
    text('四象 形象 分析', W / 2, WIN.y + WIN.h + 150, `200 44px ${FONT.serif}`, C.hanji, { align: 'center', spacing: 22, alpha: ease.sine(seg(t, 3, 4)) * 0.8 })
    vignette(0.7)
  },
}

export const scenes: Scene[] = [S01]
