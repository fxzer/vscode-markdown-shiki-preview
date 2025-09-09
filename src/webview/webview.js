// VS Code API
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi()

// 注入的 morphdom 库
const morphdom = (function () {
  'use strict'

  const DOCUMENT_FRAGMENT_NODE = 11

  function morphAttrs(fromNode, toNode) {
    const toNodeAttrs = toNode.attributes
    let attr
    let attrName
    let attrNamespaceURI
    let attrValue
    let fromValue

    // 文档片段没有属性，直接返回
    if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      return
    }

    // 更新原始 DOM 元素的属性
    for (let i = toNodeAttrs.length - 1; i >= 0; i--) {
      attr = toNodeAttrs[i]
      attrName = attr.name
      attrNamespaceURI = attr.namespaceURI
      attrValue = attr.value

      if (attrNamespaceURI) {
        attrName = attr.localName || attrName
        fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName)

        if (fromValue !== attrValue) {
          if (attr.prefix === 'xmlns') {
            attrName = attr.name // 不允许在不指定 `xmlns` 前缀的情况下设置 XMLNS 命名空间属性
          }
          fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue)
        }
      }
      else {
        fromValue = fromNode.getAttribute(attrName)

        if (fromValue !== attrValue) {
          fromNode.setAttribute(attrName, attrValue)
        }
      }
    }

    // 移除原始 DOM 元素中存在但目标元素中不存在的额外属性
    const fromNodeAttrs = fromNode.attributes

    for (let d = fromNodeAttrs.length - 1; d >= 0; d--) {
      attr = fromNodeAttrs[d]
      attrName = attr.name
      attrNamespaceURI = attr.namespaceURI

      if (attrNamespaceURI) {
        attrName = attr.localName || attrName

        if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
          fromNode.removeAttributeNS(attrNamespaceURI, attrName)
        }
      }
      else {
        if (!toNode.hasAttribute(attrName)) {
          fromNode.removeAttribute(attrName)
        }
      }
    }
  }

  let range // 创建范围对象用于高效地将字符串渲染为元素
  const NS_XHTML = 'http://www.w3.org/1999/xhtml'

  const doc = typeof document === 'undefined' ? undefined : document
  const HAS_TEMPLATE_SUPPORT = !!doc && 'content' in doc.createElement('template')
  const HAS_RANGE_SUPPORT = !!doc && doc.createRange && 'createContextualFragment' in doc.createRange()

  function createFragmentFromTemplate(str) {
    const template = doc.createElement('template')
    template.innerHTML = str
    return template.content.childNodes[0]
  }

  function createFragmentFromRange(str) {
    if (!range) {
      range = doc.createRange()
      range.selectNode(doc.body)
    }

    const fragment = range.createContextualFragment(str)
    return fragment.childNodes[0]
  }

  function createFragmentFromWrap(str) {
    const fragment = doc.createElement('body')
    fragment.innerHTML = str
    return fragment.childNodes[0]
  }

  /**
   * 将字符串转换为元素，相当于：
   * var html = new DOMParser().parseFromString(str, 'text/html');
   * return html.body.firstChild;
   *
   * @method toElement
   * @param {string} str
   */
  function toElement(str) {
    str = str.trim()
    if (HAS_TEMPLATE_SUPPORT) {
      // 避免对 `<tr><th>Hi</th></tr>` 等内容限制
      // createContextualFragment 不支持这些内容
      // IE 不支持 <template>
      return createFragmentFromTemplate(str)
    }
    else if (HAS_RANGE_SUPPORT) {
      return createFragmentFromRange(str)
    }

    return createFragmentFromWrap(str)
  }

  /**
   * 如果两个节点名称相同则返回 true
   *
   * 注意：不检查 `namespaceURI`，因为不会找到具有相同 nodeName 但不同命名空间 URI 的两个 HTML 元素
   *
   * @param {Element} fromEl
   * @param {Element} toEl 目标元素
   * @return {boolean}
   */
  function compareNodeNames(fromEl, toEl) {
    const fromNodeName = fromEl.nodeName
    const toNodeName = toEl.nodeName
    const fromCodeStart = fromNodeName.charCodeAt(0)
    const toCodeStart = toNodeName.charCodeAt(0)

    if (fromNodeName === toNodeName) {
      return true
    }

    // 如果目标元素是虚拟 DOM 节点或 SVG 节点，可能需要先规范化标签名再比较
    // 在 "http://www.w3.org/1999/xhtml" 中的普通 HTML 元素会转换为大写
    if (fromCodeStart <= 90 && toCodeStart >= 97) { // from 是大写，to 是小写
      return fromNodeName === toNodeName.toUpperCase()
    }
    else if (toCodeStart <= 90 && fromCodeStart >= 97) { // to 是大写，from 是小写
      return toNodeName === fromNodeName.toUpperCase()
    }
    else {
      return false
    }
  }

  /**
   * 创建元素，可选择指定已知的命名空间 URI
   *
   * @param {string} name 元素名称，如 'div' 或 'svg'
   * @param {string} [namespaceURI] 元素的命名空间 URI，即其 `xmlns` 属性值或推断的命名空间
   *
   * @return {Element}
   */
  function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML
      ? doc.createElement(name)
      : doc.createElementNS(namespaceURI, name)
  }

  /**
   * 将一个 DOM 元素的子元素复制到另一个 DOM 元素
   */
  function moveChildren(fromEl, toEl) {
    let curChild = fromEl.firstChild
    while (curChild) {
      const nextChild = curChild.nextSibling
      toEl.appendChild(curChild)
      curChild = nextChild
    }
    return toEl
  }

  function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
      fromEl[name] = toEl[name]
      if (fromEl[name]) {
        fromEl.setAttribute(name, '')
      }
      else {
        fromEl.removeAttribute(name)
      }
    }
  }

  const specialElHandlers = {
    OPTION(fromEl, toEl) {
      let parentNode = fromEl.parentNode
      if (parentNode) {
        let parentName = parentNode.nodeName.toUpperCase()
        if (parentName === 'OPTGROUP') {
          parentNode = parentNode.parentNode
          parentName = parentNode && parentNode.nodeName.toUpperCase()
        }
        if (parentName === 'SELECT' && !parentNode.hasAttribute('multiple')) {
          if (fromEl.hasAttribute('selected') && !toEl.selected) {
            // 修复 MS Edge 错误的变通方法，其中 'selected' 属性只有在设置为非空值时才能被移除：
            // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/12087679/
            fromEl.setAttribute('selected', 'selected')
            fromEl.removeAttribute('selected')
          }
          // 我们必须将 select 元素的 selectedIndex 重置为 -1，否则下面使用 syncBooleanAttrProp
          // 设置 fromEl.selected 不会有任何效果
          // 正确的 selectedIndex 将在下面的 SELECT 特殊处理程序中设置
          parentNode.selectedIndex = -1
        }
      }
      syncBooleanAttrProp(fromEl, toEl, 'selected')
    },
    /**
     * "value" 属性对 <input> 元素很特殊，因为它设置初始值
     * 不更改 "value" 属性而只更改 "value" 属性不会有任何效果，因为它只用于设置初始值
     * "checked" 和 "disabled" 属性类似
     */
    INPUT(fromEl, toEl) {
      syncBooleanAttrProp(fromEl, toEl, 'checked')
      syncBooleanAttrProp(fromEl, toEl, 'disabled')

      if (fromEl.value !== toEl.value) {
        fromEl.value = toEl.value
      }

      if (!toEl.hasAttribute('value')) {
        fromEl.removeAttribute('value')
      }
    },

    TEXTAREA(fromEl, toEl) {
      const newValue = toEl.value
      if (fromEl.value !== newValue) {
        fromEl.value = newValue
      }

      const firstChild = fromEl.firstChild
      if (firstChild) {
        // IE 需要。显然 IE 将占位符设置为节点值，反之亦然。这会忽略空更新
        const oldValue = firstChild.nodeValue

        if (oldValue === newValue || (!newValue && oldValue === fromEl.placeholder)) {
          return
        }

        firstChild.nodeValue = newValue
      }
    },
    SELECT(fromEl, toEl) {
      if (!toEl.hasAttribute('multiple')) {
        let selectedIndex = -1
        let i = 0
        // 必须遍历 fromEl 的子元素，而不是 toEl，因为在变形时节点可能直接从 toEl 移动到 fromEl
        // 在调用此特殊处理程序时，所有子元素都已被变形并附加到/从 fromEl 中移除，所以在这里使用 fromEl 是安全且正确的
        let curChild = fromEl.firstChild
        let optgroup
        let nodeName
        while (curChild) {
          nodeName = curChild.nodeName && curChild.nodeName.toUpperCase()
          if (nodeName === 'OPTGROUP') {
            optgroup = curChild
            curChild = optgroup.firstChild
            // 处理空的 optgroups
            if (!curChild) {
              curChild = optgroup.nextSibling
              optgroup = null
            }
          }
          else {
            if (nodeName === 'OPTION') {
              if (curChild.hasAttribute('selected')) {
                selectedIndex = i
                break
              }
              i++
            }
            curChild = curChild.nextSibling
            if (!curChild && optgroup) {
              curChild = optgroup.nextSibling
              optgroup = null
            }
          }
        }

        fromEl.selectedIndex = selectedIndex
      }
    },
  }

  const ELEMENT_NODE = 1
  const DOCUMENT_FRAGMENT_NODE$1 = 11
  const TEXT_NODE = 3
  const COMMENT_NODE = 8

  function noop() {}

  function defaultGetNodeKey(node) {
    if (node) {
      return (node.getAttribute && node.getAttribute('id')) || node.id
    }
  }

  function morphdomFactory(morphAttrs) {
    return function morphdom(fromNode, toNode, options) {
      if (!options) {
        options = {}
      }

      if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML' || fromNode.nodeName === 'BODY') {
          const toNodeHtml = toNode
          toNode = doc.createElement('html')
          toNode.innerHTML = toNodeHtml
        }
        else {
          toNode = toElement(toNode)
        }
      }
      else if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
        toNode = toNode.firstElementChild
      }

      const getNodeKey = options.getNodeKey || defaultGetNodeKey
      const onBeforeNodeAdded = options.onBeforeNodeAdded || noop
      const onNodeAdded = options.onNodeAdded || noop
      const onBeforeElUpdated = options.onBeforeElUpdated || noop
      const onElUpdated = options.onElUpdated || noop
      const onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop
      const onNodeDiscarded = options.onNodeDiscarded || noop
      const onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop
      const skipFromChildren = options.skipFromChildren || noop
      const addChild = options.addChild || function (parent, child) {
        return parent.appendChild(child)
      }
      const childrenOnly = options.childrenOnly === true

      // 此对象用作查找表，用于快速找到原始 DOM 树中所有带键的元素
      const fromNodesLookup = Object.create(null)
      const keyedRemovalList = []

      function addKeyedRemoval(key) {
        keyedRemovalList.push(key)
      }

      function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
          let curChild = node.firstChild
          while (curChild) {
            const key = getNodeKey(curChild)

            if (skipKeyedNodes && key) {
              // 如果我们要跳过带有 key 的节点，则将 key 添加到列表，稍后处理
              addKeyedRemoval(key)
            }
            else {
              // 只有在节点没有键时才报告为已丢弃。这样做是因为
              // 最后我们会遍历所有未匹配的带键元素，然后在一次最终传递中丢弃它们
              onNodeDiscarded(curChild)
              if (curChild.firstChild) {
                walkDiscardedChildNodes(curChild, skipKeyedNodes)
              }
            }

            curChild = curChild.nextSibling
          }
        }
      }

      /**
       * Removes a DOM node out of the original DOM
       *
       * @param  {Node} node The node to remove
       * @param  {Node} parentNode The nodes parent
       * @param  {boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
       * @return {undefined}
       */
      function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
          return
        }

        if (parentNode) {
          parentNode.removeChild(node)
        }

        onNodeDiscarded(node)
        walkDiscardedChildNodes(node, skipKeyedNodes)
      }

      function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
          let curChild = node.firstChild
          while (curChild) {
            const key = getNodeKey(curChild)
            if (key) {
              fromNodesLookup[key] = curChild
            }

            // 递归遍历
            indexTree(curChild)

            curChild = curChild.nextSibling
          }
        }
      }

      indexTree(fromNode)

      function handleNodeAdded(el) {
        if (!el)
          return

        onNodeAdded(el)

        let curChild = el.firstChild
        while (curChild) {
          const nextSibling = curChild.nextSibling

          const key = getNodeKey(curChild)
          if (key) {
            const unmatchedFromEl = fromNodesLookup[key]
            // 如果在缓存中找到重复的 #id 节点，用缓存值替换 `el` 并将其变形为子节点
            if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
              curChild.parentNode.replaceChild(unmatchedFromEl, curChild)
              morphEl(unmatchedFromEl, curChild)
            }
            else {
              handleNodeAdded(curChild)
            }
          }
          else {
            // 递归调用 curChild 及其子元素，看看是否在 fromNodesLookup 中找到什么
            handleNodeAdded(curChild)
          }

          curChild = nextSibling
        }
      }

      function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
        while (curFromNodeChild) {
          const fromNextSibling = curFromNodeChild.nextSibling
          curFromNodeKey = getNodeKey(curFromNodeChild)
          if (curFromNodeKey) {
            // 由于节点有键，它可能稍后匹配，所以我们推迟实际移除
            addKeyedRemoval(curFromNodeKey)
          }
          else {
            // 注意：我们跳过嵌套的带键节点被移除，因为它们仍有可能稍后匹配
            removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
          }
          curFromNodeChild = fromNextSibling
        }
      }

      function morphEl(fromEl, toEl, childrenOnly) {
        const toElKey = getNodeKey(toEl)

        if (toElKey) {
          // 如果正在变形带 ID 的元素，它将在最终 DOM 中，所以从保存的元素集合中清除它
          delete fromNodesLookup[toElKey]
        }

        if (!childrenOnly) {
          // 可选的
          const beforeUpdateResult = onBeforeElUpdated(fromEl, toEl)
          if (beforeUpdateResult === false) {
            return
          }
          else if (beforeUpdateResult instanceof HTMLElement) {
            fromEl = beforeUpdateResult
            // 重新索引新的 fromEl，以防它与原始 fromEl 不在同一棵树中
            // (Phoenix LiveView 有时返回克隆的树，但带键查找仍会指向原始树)
            indexTree(fromEl)
          }

          // 首先更新原始 DOM 元素的属性
          morphAttrs(fromEl, toEl)
          // 可选的
          onElUpdated(fromEl)

          if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
            return
          }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
          morphChildren(fromEl, toEl)
        }
        else {
          specialElHandlers.TEXTAREA(fromEl, toEl)
        }
      }

      function morphChildren(fromEl, toEl) {
        const skipFrom = skipFromChildren(fromEl, toEl)
        let curToNodeChild = toEl.firstChild
        let curFromNodeChild = fromEl.firstChild
        let curToNodeKey
        let curFromNodeKey

        let fromNextSibling
        let toNextSibling
        let matchingFromEl

        // 遍历子元素
        while (curToNodeChild) {
          toNextSibling = curToNodeChild.nextSibling
          curToNodeKey = getNodeKey(curToNodeChild)
          let foundMatch = false

          // 完全遍历 fromNode 子元素
          // eslint-disable-next-line no-unmodified-loop-condition
          while (!skipFrom && curFromNodeChild) {
            fromNextSibling = curFromNodeChild.nextSibling

            if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
              foundMatch = true
              break
            }

            curFromNodeKey = getNodeKey(curFromNodeChild)

            const curFromNodeType = curFromNodeChild.nodeType

            // 这意味着如果 curFromNodeChild 与 curToNodeChild 不匹配
            let isCompatible

            if (curFromNodeType === curToNodeChild.nodeType) {
              if (curFromNodeType === ELEMENT_NODE) {
                // 被比较的两个节点都是元素节点

                if (curToNodeKey) {
                  // 目标节点有键，所以我们想将其与原始 DOM 树中的正确元素匹配
                  if (curToNodeKey !== curFromNodeKey) {
                    // 原始 DOM 树中的当前元素没有匹配的键，所以
                    // 让我们检查查找表，看看原始 DOM 树中是否有匹配的元素
                    matchingFromEl = fromNodesLookup[curToNodeKey]
                    if (matchingFromEl) {
                      if (fromNextSibling === matchingFromEl) {
                        // 单元素移除的特殊情况。为了避免从树中移除原始 DOM 节点
                        // (因为这可能破坏 CSS 过渡等)，我们将丢弃当前节点并等待下一次
                        // 迭代来正确匹配带键的目标元素与其在原始树中的匹配元素
                        isCompatible = false
                      }
                      else {
                        // 我们在原始 DOM 树中找到了匹配的带键元素
                        // 让我们将原始 DOM 节点移动到当前位置并变形它

                        // 注意：我们使用 insertBefore 而不是 replaceChild，因为我们希望通过
                        // `removeNode()` 函数处理被丢弃的节点，以便正确调用所有生命周期钩子
                        fromEl.insertBefore(matchingFromEl, curFromNodeChild)

                        if (curFromNodeKey) {
                          // 由于节点有键，它可能稍后匹配，所以我们推迟实际移除
                          addKeyedRemoval(curFromNodeKey)
                        }
                        else {
                          // 注意：我们跳过嵌套的带键节点被移除，因为它们仍有可能稍后匹配
                          removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
                        }

                        curFromNodeChild = matchingFromEl
                        curFromNodeKey = getNodeKey(curFromNodeChild)
                      }
                    }
                    else {
                      // 节点不兼容，因为 "to" 节点有键但源树中没有匹配的带键节点
                      isCompatible = false
                    }
                  }
                }
                else if (curFromNodeKey) {
                  // 原始节点有键
                  isCompatible = false
                }

                isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild)
                if (isCompatible) {
                  // 我们找到了兼容的 DOM 元素，所以将当前的 "from" 节点变形为匹配当前的
                  // 目标 DOM 节点
                  // 变形
                  morphEl(curFromNodeChild, curToNodeChild)
                }
              }
              else if (curFromNodeType === TEXT_NODE || curFromNodeType === COMMENT_NODE) {
                // 被比较的两个节点都是文本或注释节点
                isCompatible = true
                // 简单地更新原始节点的 nodeValue 来更改文本值
                if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                  curFromNodeChild.nodeValue = curToNodeChild.nodeValue
                }
              }
            }

            if (isCompatible) {
              // 推进 "to" 子元素和 "from" 子元素，因为我们找到了匹配
              // 不需要做其他事情，因为我们已经在上面递归调用了 morphChildren
              curToNodeChild = toNextSibling
              curFromNodeChild = fromNextSibling
              foundMatch = true
              break
            }

            // 没有兼容的匹配，所以从 DOM 中移除旧节点并继续尝试在原始 DOM 中查找匹配
            // 但是，我们只在 from 节点没有键时才这样做，因为带键的节点可能与目标树中
            // 其他地方的节点匹配，我们不想现在就丢弃它，因为它仍可能在最终 DOM 树中找到
            // 归宿。完成后，我们将移除任何没有找到归宿的带键节点
            if (curFromNodeKey) {
              // 由于节点有键，它可能稍后匹配，所以我们推迟实际移除
              addKeyedRemoval(curFromNodeKey)
            }
            else {
              // 注意：我们跳过嵌套的带键节点被移除，因为它们仍有可能稍后匹配
              removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
            }

            curFromNodeChild = fromNextSibling
          } // 结束：while(curFromNodeChild) {}

          // 如果我们到达这里，那么我们没有为 "to node" 找到候选匹配，并且我们
          // 已经用尽了所有 "from" 子节点。因此，我们只需将当前的 "to" 节点附加到末尾
          matchingFromEl = fromNodesLookup[curToNodeKey]
          if (curToNodeKey && matchingFromEl && compareNodeNames(matchingFromEl, curToNodeChild)) {
            // 变形
            if (!skipFrom && matchingFromEl && matchingFromEl.nodeType) {
              addChild(fromEl, matchingFromEl)
            }
            morphEl(matchingFromEl, curToNodeChild)
          }
          else {
            const onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild)
            if (onBeforeNodeAddedResult !== false) {
              if (onBeforeNodeAddedResult) {
                curToNodeChild = onBeforeNodeAddedResult
              }

              if (curToNodeChild && curToNodeChild.actualize) {
                curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc)
              }
              if (curToNodeChild && curToNodeChild.nodeType) {
                addChild(fromEl, curToNodeChild)
                handleNodeAdded(curToNodeChild)
              }
            }
          }

          if (foundMatch) {
            curToNodeChild = toNextSibling
            curFromNodeChild = fromNextSibling
          }
          else {
            curToNodeChild = toNextSibling
            // 不要在这里推进 curFromNodeChild，因为它可能在下次迭代中需要
          }
        }

        cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey)

        const specialElHandler = specialElHandlers[fromEl.nodeName]
        if (specialElHandler) {
          specialElHandler(fromEl, toEl)
        }
      } // 结束：morphChildren(...)

      let morphedNode = fromNode
      const morphedNodeType = morphedNode.nodeType
      const toNodeType = toNode.nodeType

      if (!childrenOnly) {
        // 处理我们被给定两个不兼容的 DOM 节点的情况
        // (例如 <div> --> <span> 或 <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
          if (toNodeType === ELEMENT_NODE) {
            if (!compareNodeNames(fromNode, toNode)) {
              onNodeDiscarded(fromNode)
              morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI))
            }
          }
          else {
            // 从元素节点变为文本节点
            morphedNode = toNode
          }
        }
        else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // 文本或注释节点
          if (toNodeType === morphedNodeType) {
            if (morphedNode.nodeValue !== toNode.nodeValue) {
              morphedNode.nodeValue = toNode.nodeValue
            }

            return morphedNode
          }
          else {
            // 文本节点变为其他类型
            morphedNode = toNode
          }
        }
      }

      if (morphedNode === toNode) {
        // "to node" 与 "from node" 不兼容，所以我们不得不
        // 丢弃 "from node" 并使用 "to node"
        onNodeDiscarded(fromNode)
      }
      else {
        if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
          return
        }

        morphEl(morphedNode, toNode, childrenOnly)

        // 我们现在需要遍历可能需要移除的任何带键节点
        // 我们只在知道带键节点从未找到匹配时才进行移除
        // 当带键节点匹配时，我们从 fromNodesLookup 中移除它，并使用 fromNodesLookup 来确定
        // 带键节点是否已匹配
        if (keyedRemovalList) {
          for (let i = 0, len = keyedRemovalList.length; i < len; i++) {
            const elToRemove = fromNodesLookup[keyedRemovalList[i]]
            if (elToRemove) {
              removeNode(elToRemove, elToRemove.parentNode, false)
            }
          }
        }
      }

      if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode && morphedNode.actualize) {
          morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc)
        }
        // 如果我们必须用新节点替换 from 节点，因为旧节点与目标节点不兼容，
        // 那么我们需要在原始 DOM 树中替换旧 DOM 节点。这只有在原始 DOM 节点
        // 是 DOM 树的一部分时才可能，我们知道如果它有父节点就是这种情况
        fromNode.parentNode.replaceChild(morphedNode, fromNode)
      }

      return morphedNode
    }
  }

  return morphdomFactory(morphAttrs)
})()

// 处理链接点击事件
document.addEventListener('click', (event) => {
  let target = event.target
  // 处理 <a> 标签内部元素的点击事件，确保我们总能拿到 <a> 元素
  while (target && target.tagName !== 'A') {
    target = target.parentElement
  }

  if (target && target.tagName === 'A') {
    const hrefAttr = target.getAttribute('href')

    if (!hrefAttr) {
      return
    }

    // 处理外部链接
    if (hrefAttr.startsWith('http://') || hrefAttr.startsWith('https://') || hrefAttr.startsWith('//')) {
      event.preventDefault()
      event.stopPropagation() // 阻止事件冒泡
      vscode.postMessage({
        command: 'openExternal',
        url: hrefAttr,
      })
    }
    // 处理相对路径链接（.md 文件）
    else if (hrefAttr.endsWith('.md')) {
      event.preventDefault()
      vscode.postMessage({
        command: 'openRelativeFile',
        // 关键修复：使用 href 属性值作为文件路径
        filePath: hrefAttr,
        href: hrefAttr, // 保持消息结构一致性
      })
    }
    // 此处可以添加对锚点链接 # 的处理，如果需要的话
  }
})

// 配置 Mermaid
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

      // 10 秒超时
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
      // Mermaid 库加载成功
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

// 初始化 Mermaid
async function initMermaid() {
  // 尝试初始化 Mermaid

  try {
    // 先加载 Mermaid 库
    await loadMermaidLibrary()

    // Mermaid 库已加载，正在初始化
    if (typeof mermaid !== 'undefined') {
      // eslint-disable-next-line no-undef
      mermaid.initialize(mermaidConfig)

      // 等待一小段时间确保 DOM 完全加载
      setTimeout(() => {
        // 开始渲染 Mermaid 图表
        renderMermaidCharts()
      }, 500)
    }
  }
  catch {
    // Mermaid 初始化失败，错误已在其他地方处理
  }
}

// 渲染所有 Mermaid 图表
function renderMermaidCharts() {
  const mermaidElements = document.querySelectorAll('.mermaid')
  // 找到 Mermaid 代码块

  if (mermaidElements.length === 0) {
    return
  }

  mermaidElements.forEach((element, index) => {
    const graphDefinition = element.textContent.trim()
    const graphId = `graph-${index}-${Date.now()}`

    try {
      // 使用最新的 Mermaid API
      if (typeof mermaid !== 'undefined') {
        // eslint-disable-next-line no-undef
        mermaid.render(graphId, graphDefinition).then(({ svg }) => {
          element.innerHTML = svg
        }).catch((error) => {
          console.error('Mermaid render error:', error)
          element.innerHTML = `<pre style="color: red;">Mermaid 渲染错误: ${error.message}</pre>`
        })
      }
    }
    catch (error) {
      console.error('Mermaid error:', error)
      element.innerHTML = `<pre style="color: red;">Mermaid 解析错误: ${error.message}</pre>`
    }
  })
}

// 检查是否有 Mermaid 代码块
function hasMermaidBlocks() {
  return document.querySelectorAll('.mermaid').length > 0
}

// 监听 VS Code 消息
window.addEventListener('message', (event) => {
  const message = event.data

  switch (message.command) {
    case 'update-style': {
      document.documentElement.style.setProperty(message.key, message.value)
      break
    }
    case 'update-content': {
      const contentBody = document.getElementById('content-body')
      if (contentBody) {
        const newContent = document.createElement('div')
        newContent.id = 'content-body'
        newContent.innerHTML = message.html
        morphdom(contentBody, newContent)

        // 重新渲染 Mermaid 图表
        if (mermaidLoaded) {
          renderMermaidCharts()
        }
      }
      break
    }
    case 'updateTheme': {
      mermaidConfig.theme = message.theme
      if (mermaidLoaded && typeof mermaid !== 'undefined') {
        // eslint-disable-next-line no-undef
        mermaid.initialize(mermaidConfig)
        renderMermaidCharts()
      }
      break
    }
    case 'toggleMermaid': {
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
      break
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
