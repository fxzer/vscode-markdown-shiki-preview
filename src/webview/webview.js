// VS Code API
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi()

// 处理外部链接点击
document.addEventListener('click', (event) => {
  if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
    event.preventDefault()
    vscode.postMessage({
      command: 'openExternal',
      url: event.target.href,
    })
  }
})

// 滚动同步 - 优化版本，带防抖、阈值控制和缓存
let isScrollingFromEditor = false
let scrollTimeout = null
let lastScrollPercentage = -1
let cachedDocumentHeight = 0
let cachedViewportHeight = 0
let heightCacheTime = 0
const HEIGHT_CACHE_DURATION = 1000
const SCROLL_THRESHOLD = 0.005

// 获取文档内容的总高度（带缓存）
function getDocumentHeight() {
  const now = Date.now()
  if (now - heightCacheTime < HEIGHT_CACHE_DURATION && cachedDocumentHeight > 0) {
    return cachedDocumentHeight
  }

  cachedDocumentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight,
  )
  heightCacheTime = now
  return cachedDocumentHeight
}

// 获取视口高度（带缓存）
function getViewportHeight() {
  const now = Date.now()
  if (now - heightCacheTime < HEIGHT_CACHE_DURATION && cachedViewportHeight > 0) {
    return cachedViewportHeight
  }

  cachedViewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
  return cachedViewportHeight
}

// 优化的滚动处理函数
function handleScroll() {
  if (isScrollingFromEditor) {
    return
  }

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const documentHeight = getDocumentHeight()
  const viewportHeight = getViewportHeight()
  const maxScrollTop = Math.max(0, documentHeight - viewportHeight)

  const scrollPercentage = maxScrollTop > 0
    ? Math.max(0, Math.min(1, scrollTop / maxScrollTop))
    : 0

  if (Math.abs(scrollPercentage - lastScrollPercentage) < SCROLL_THRESHOLD) {
    return
  }

  lastScrollPercentage = scrollPercentage

  vscode.postMessage({
    command: 'scroll',
    scrollPercentage,
    source: 'preview',
  })
}

// 防抖滚动处理
function debouncedHandleScroll() {
  if (scrollTimeout) {
    return
  }

  scrollTimeout = requestAnimationFrame(() => {
    handleScroll()
    scrollTimeout = null
  })
}

// 监听滚动事件，使用防抖处理
document.addEventListener('scroll', debouncedHandleScroll, { passive: true })

// 监听窗口大小变化，清除高度缓存
window.addEventListener('resize', () => {
  cachedDocumentHeight = 0
  cachedViewportHeight = 0
  heightCacheTime = 0
}, { passive: true })

// 监听来自扩展的消息
window.addEventListener('message', (event) => {
  const message = event.data

  switch (message.command) {
    case 'scrollToPercentage':
    { if (message.source === 'preview') {
      break
    }

    isScrollingFromEditor = true

    const documentHeight = getDocumentHeight()
    const viewportHeight = getViewportHeight()
    const maxScrollTop = Math.max(0, documentHeight - viewportHeight)
    const targetScrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop * message.percentage))

    window.scrollTo({
      top: targetScrollTop,
      behavior: 'auto',
    })

    setTimeout(() => {
      isScrollingFromEditor = false
    }, 150)
    break }
  }
})
