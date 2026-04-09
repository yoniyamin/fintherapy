import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'

function setAppHeight() {
  const inner = window.innerHeight
  const client = document.documentElement.clientHeight
  const vv = window.visualViewport
  const vvH = vv?.height ?? 0
  const vvSpan = vv ? vv.offsetTop + vv.height : 0
  const h = Math.max(inner, client, vvH, vvSpan)
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}

setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', () => {
  setAppHeight()
  setTimeout(setAppHeight, 100)
})
window.visualViewport?.addEventListener('resize', setAppHeight)

createRoot(document.getElementById('root')!).render(<App />)
