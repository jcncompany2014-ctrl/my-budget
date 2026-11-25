import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@fontsource/noto-serif-kr/500.css'
import '@fontsource/noto-serif-kr/700.css'
import './index.css'
import App from './App.tsx'

// 키오스크: 우클릭/핀치줌/드래그 방지
window.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('gesturestart', (e) => e.preventDefault())
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
