#!/usr/bin/env node
// 스토리보드 프레임 렌더러 (개발 서버 http://localhost:5173 필요)
// 스틸:   node design/render.cjs stills --scenes S01,S02 --times 0.5,2,3.9 --out /tmp/x
//         (--times 생략 시 각 장면 10%,50%,90% 지점)
// 애니메틱: node design/render.cjs video --fps 12 --out /tmp/x/animatic.mp4 [--scenes S01,S02] [--scale 0.5]
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const args = process.argv.slice(2)
const mode = args[0]
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const out = opt('out', '/tmp/sb')
;(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu-vsync'] })
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto('http://localhost:5173/design/storyboard.html')
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 })
  const list = await p.evaluate(() => window.SB.list())
  const want = opt('scenes', '') ? opt('scenes').split(',') : list.map((s) => s.id)
  const scenes = list.filter((s) => want.includes(s.id))
  const save = async (file) => {
    const url = await p.evaluate(() => window.SB.jpeg(0.88))
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  }
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true })
    for (const s of scenes) {
      const times = opt('times') ? opt('times').split(',').map(Number) : [0.1, 0.5, 0.9].map((k) => +(s.dur * k).toFixed(2))
      for (const t of times) {
        try { await p.evaluate(([id, tt]) => window.SB.render(id, tt), [s.id, t]) } catch (e) { errs.push(`${s.id}@${t}: ${e.message}`); continue }
        const f = path.join(out, `${s.id}_${String(t).replace('.', '_')}.jpg`)
        await save(f)
        console.log(f)
      }
    }
  } else if (mode === 'video') {
    const fps = Number(opt('fps', 12))
    const dir = out.replace(/\.mp4$/, '') + '_frames'
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    let n = 0
    for (const s of scenes) {
      const frames = Math.round(s.dur * fps)
      for (let i = 0; i < frames; i++) {
        const t = i / fps
        try { await p.evaluate(([id, tt]) => window.SB.render(id, tt), [s.id, t]) } catch (e) { errs.push(`${s.id}@${t}: ${e.message}`) }
        await save(path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`))
      }
      console.log(`${s.id} ${frames} frames`)
    }
    const scale = Number(opt('scale', 0.5))
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.jpg'),
      '-vf', `scale=${Math.round(1080 * scale / 2) * 2}:-2,format=yuv420p`, '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', out])
    console.log('video', out)
  }
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1 }
  await b.close()
})()
