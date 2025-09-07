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

// 配置mermaid
const mermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    useMaxWidth: true,
    wrap: true,
  },
  gantt: {
    useMaxWidth: true,
  },
  journey: {
    useMaxWidth: true,
  },
  pie: {
    useMaxWidth: true,
  },
}

// Mermaid 库是否已加载
let mermaidLoaded = false
let mermaidLoading = false

// 动态加载 Mermaid 库
function loadMermaidLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof mermaid !== 'undefined') {
      mermaidLoaded = true
      resolve()
      return
    }

    if (mermaidLoading) {
      // 如果正在加载，等待加载完成
      const checkInterval = setInterval(() => {
        if (typeof mermaid !== 'undefined') {
          clearInterval(checkInterval)
          mermaidLoaded = true
          mermaidLoading = false
          resolve()
        }
      }, 100)

      // 10秒超时
      setTimeout(() => {
        clearInterval(checkInterval)
        mermaidLoading = false
        reject(new Error('Mermaid 库加载超时'))
      }, 10000)

      return
    }

    mermaidLoading = true

    // 创建脚本标签
    const script = document.createElement('script')
    script.id = 'mermaid-script'
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
    script.async = true

    script.onload = () => {
      mermaidLoaded = true
      mermaidLoading = false
      console.log('Mermaid 库加载成功')
      resolve()
    }

    script.onerror = () => {
      mermaidLoading = false
      console.error('Mermaid 库加载失败')
      reject(new Error('Mermaid 库加载失败'))
    }

    document.head.appendChild(script)
  })
}

// 初始化mermaid
async function initMermaid() {
  console.log('尝试初始化 Mermaid...')

  try {
    // 先加载 Mermaid 库
    await loadMermaidLibrary()

    console.log('Mermaid 库已加载，正在初始化...')
    mermaid.initialize(mermaidConfig)

    // 等待一小段时间确保 DOM 完全加载
    setTimeout(() => {
      console.log('开始渲染 Mermaid 图表...')
      renderMermaidCharts()
    }, 500)
  }
  catch (error) {
    console.error('Mermaid 初始化失败:', error)
  }
}

// 渲染所有mermaid图表
function renderMermaidCharts() {
  const mermaidElements = document.querySelectorAll('.mermaid')
  console.log(`找到 ${mermaidElements.length} 个 Mermaid 代码块`)

  if (mermaidElements.length === 0) {
    return
  }

  mermaidElements.forEach((element, index) => {
    const graphDefinition = element.textContent.trim()
    const graphId = `graph-${index}-${Date.now()}`

    try {
      // 使用最新的mermaid API
      mermaid.render(graphId, graphDefinition).then(({ svg }) => {
        element.innerHTML = svg
      }).catch((error) => {
        console.error('Mermaid render error:', error)
        element.innerHTML = `<pre style="color: red;">Mermaid渲染错误: ${error.message}</pre>`
      })
    }
    catch (error) {
      console.error('Mermaid error:', error)
      element.innerHTML = `<pre style="color: red;">Mermaid解析错误: ${error.message}</pre>`
    }
  })
}

// 检查是否有 Mermaid 代码块
function hasMermaidBlocks() {
  return document.querySelectorAll('.mermaid').length > 0
}

// 监听内容变化，重新渲染 Mermaid 图表
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes) {
      // 检查是否有新的 Mermaid 代码块添加
      const hasNewMermaid = Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node.classList?.contains('mermaid')
            || node.querySelector?.('.mermaid') !== null
        }
        return false
      })

      if (hasNewMermaid && mermaidLoaded) {
        console.log('检测到新的 Mermaid 代码块，重新渲染...')
        renderMermaidCharts()
      }
    }
  })
})

// 开始观察整个文档的变化
observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// 监听VSCode消息
window.addEventListener('message', (event) => {
  const message = event.data

  // 处理主题变化
  if (message.type === 'updateTheme') {
    mermaidConfig.theme = message.theme
    if (mermaidLoaded) {
      mermaid.initialize(mermaidConfig)
      renderMermaidCharts()
    }
  }

  // 处理 Mermaid 开关变化
  if (message.command === 'toggleMermaid') {
    const enableMermaid = message.enabled

    if (enableMermaid) {
      // 启用 Mermaid
      if (hasMermaidBlocks()) {
        initMermaid()
      }
    }
    else {
      // 禁用 Mermaid - 将所有 Mermaid 代码块转换为普通代码块
      const mermaidElements = document.querySelectorAll('.mermaid')
      mermaidElements.forEach((element) => {
        const code = element.textContent.trim()
        element.outerHTML = `<pre><code class="language-mermaid">${code}</code></pre>`
      })
    }
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
