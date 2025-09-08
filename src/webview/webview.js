// VS Code API
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi()

// Injected morphdom
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

    // document-fragments dont have attributes so lets not do anything
    if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      return
    }

    // update attributes on original DOM element
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
            attrName = attr.name // It's not allowed to set an attribute with the XMLNS namespace without specifying the `xmlns` prefix
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

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
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

  let range // Create a range object for efficently rendering strings to elements.
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
   * This is about the same
   * var html = new DOMParser().parseFromString(str, 'text/html');
   * return html.body.firstChild;
   *
   * @method toElement
   * @param {string} str
   */
  function toElement(str) {
    str = str.trim()
    if (HAS_TEMPLATE_SUPPORT) {
      // avoid restrictions on content for things like `<tr><th>Hi</th></tr>` which
      // createContextualFragment doesn't support
      // <template> support not available in IE
      return createFragmentFromTemplate(str)
    }
    else if (HAS_RANGE_SUPPORT) {
      return createFragmentFromRange(str)
    }

    return createFragmentFromWrap(str)
  }

  /**
   * Returns true if two node's names are the same.
   *
   * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
   *       nodeName and different namespace URIs.
   *
   * @param {Element} fromEl
   * @param {Element} toEl The target element
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

    // If the target element is a virtual DOM node or SVG node then we may
    // need to normalize the tag name before comparing. Normal HTML elements that are
    // in the "http://www.w3.org/1999/xhtml"
    // are converted to upper case
    if (fromCodeStart <= 90 && toCodeStart >= 97) { // from is upper and to is lower
      return fromNodeName === toNodeName.toUpperCase()
    }
    else if (toCodeStart <= 90 && fromCodeStart >= 97) { // to is upper and from is lower
      return toNodeName === fromNodeName.toUpperCase()
    }
    else {
      return false
    }
  }

  /**
   * Create an element, optionally with a known namespace URI.
   *
   * @param {string} name the element name, e.g. 'div' or 'svg'
   * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
   * its `xmlns` attribute or its inferred namespace.
   *
   * @return {Element}
   */
  function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML
      ? doc.createElement(name)
      : doc.createElementNS(namespaceURI, name)
  }

  /**
   * Copies the children of one DOM element to another DOM element
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
            // Workaround for MS Edge bug where the 'selected' attribute can only be
            // removed if set to a non-empty value:
            // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/12087679/
            fromEl.setAttribute('selected', 'selected')
            fromEl.removeAttribute('selected')
          }
          // We have to reset select element's selectedIndex to -1, otherwise setting
          // fromEl.selected using the syncBooleanAttrProp below has no effect.
          // The correct selectedIndex will be set in the SELECT special handler below.
          parentNode.selectedIndex = -1
        }
      }
      syncBooleanAttrProp(fromEl, toEl, 'selected')
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
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
        // Needed for IE. Apparently IE sets the placeholder as the
        // node value and vise versa. This ignores an empty update.
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
        // We have to loop through children of fromEl, not toEl since nodes can be moved
        // from toEl to fromEl directly when morphing.
        // At the time this special handler is invoked, all children have already been morphed
        // and appended to / removed from fromEl, so using fromEl here is safe and correct.
        let curChild = fromEl.firstChild
        let optgroup
        let nodeName
        while (curChild) {
          nodeName = curChild.nodeName && curChild.nodeName.toUpperCase()
          if (nodeName === 'OPTGROUP') {
            optgroup = curChild
            curChild = optgroup.firstChild
            // handle empty optgroups
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

      // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
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
              // 如果我们要跳过带有 key 的节点，则将 key 添加到列表，稍后处理。
              addKeyedRemoval(key)
            }
            else {
              // Only report the node as discarded if it is not keyed. We do this because
              // at the end we loop through all keyed elements that were unmatched
              // and then discard them in one final pass.
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

      // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
      // function indexTree(root) {
      //     var treeWalker = document.createTreeWalker(
      //         root,
      //         NodeFilter.SHOW_ELEMENT);
      //
      //     var el;
      //     while((el = treeWalker.nextNode())) {
      //         var key = getNodeKey(el);
      //         if (key) {
      //             fromNodesLookup[key] = el;
      //         }
      //     }
      // }

      // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
      //
      // function indexTree(node) {
      //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
      //     var el;
      //     while((el = nodeIterator.nextNode())) {
      //         var key = getNodeKey(el);
      //         if (key) {
      //             fromNodesLookup[key] = el;
      //         }
      //     }
      // }

      function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
          let curChild = node.firstChild
          while (curChild) {
            const key = getNodeKey(curChild)
            if (key) {
              fromNodesLookup[key] = curChild
            }

            // Walk recursively
            indexTree(curChild)

            curChild = curChild.nextSibling
          }
        }
      }

      indexTree(fromNode)

      function handleNodeAdded(el) {
        onNodeAdded(el)

        let curChild = el.firstChild
        while (curChild) {
          const nextSibling = curChild.nextSibling

          const key = getNodeKey(curChild)
          if (key) {
            const unmatchedFromEl = fromNodesLookup[key]
            // if we find a duplicate #id node in cache, replace `el` with cache value
            // and morph it to the child node.
            if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
              curChild.parentNode.replaceChild(unmatchedFromEl, curChild)
              morphEl(unmatchedFromEl, curChild)
            }
            else {
              handleNodeAdded(curChild)
            }
          }
          else {
            // recursively call for curChild and it's children to see if we find something in
            // fromNodesLookup
            handleNodeAdded(curChild)
          }

          curChild = nextSibling
        }
      }

      function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
        // We have processed all of the "to nodes". If curFromNodeChild is
        // non-null then we still have some from nodes left over that need
        // to be removed
        while (curFromNodeChild) {
          const fromNextSibling = curFromNodeChild.nextSibling
          curFromNodeKey = getNodeKey(curFromNodeChild)
          if (curFromNodeKey) {
            // Since the node is keyed it might be matched up later so we defer
            // the actual removal to later
            addKeyedRemoval(curFromNodeKey)
          }
          else {
            // NOTE: we skip nested keyed nodes from being removed since there is
            //       still a chance they will be matched up later
            removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
          }
          curFromNodeChild = fromNextSibling
        }
      }

      function morphEl(fromEl, toEl, childrenOnly) {
        const toElKey = getNodeKey(toEl)

        if (toElKey) {
          // If an element with an ID is being morphed then it will be in the final
          // DOM so clear it out of the saved elements collection
          delete fromNodesLookup[toElKey]
        }

        if (!childrenOnly) {
          // optional
          const beforeUpdateResult = onBeforeElUpdated(fromEl, toEl)
          if (beforeUpdateResult === false) {
            return
          }
          else if (beforeUpdateResult instanceof HTMLElement) {
            fromEl = beforeUpdateResult
            // reindex the new fromEl in case it's not in the same
            // tree as the original fromEl
            // (Phoenix LiveView sometimes returns a cloned tree,
            //  but keyed lookups would still point to the original tree)
            indexTree(fromEl)
          }

          // update attributes on original DOM element first
          morphAttrs(fromEl, toEl)
          // optional
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

        // walk the children
        while (curToNodeChild) {
          toNextSibling = curToNodeChild.nextSibling
          curToNodeKey = getNodeKey(curToNodeChild)
          let foundMatch = false

          // walk the fromNode children all the way through
          // eslint-disable-next-line no-unmodified-loop-condition
          while (!skipFrom && curFromNodeChild) {
            fromNextSibling = curFromNodeChild.nextSibling

            if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
              curToNodeChild = toNextSibling
              curFromNodeChild = fromNextSibling
              foundMatch = true
              break
            }

            curFromNodeKey = getNodeKey(curFromNodeChild)

            const curFromNodeType = curFromNodeChild.nodeType

            // this means if the curFromNodeChild doesnt have a match with the curToNodeChild
            let isCompatible

            if (curFromNodeType === curToNodeChild.nodeType) {
              if (curFromNodeType === ELEMENT_NODE) {
                // Both nodes being compared are Element nodes

                if (curToNodeKey) {
                  // The target node has a key so we want to match it up with the correct element
                  // in the original DOM tree
                  if (curToNodeKey !== curFromNodeKey) {
                    // The current element in the original DOM tree does not have a matching key so
                    // let's check our lookup to see if there is a matching element in the original
                    // DOM tree
                    matchingFromEl = fromNodesLookup[curToNodeKey]
                    if (matchingFromEl) {
                      if (fromNextSibling === matchingFromEl) {
                        // Special case for single element removals. To avoid removing the original
                        // DOM node out of the tree (since that can break CSS transitions, etc.),
                        // we will instead discard the current node and wait until the next
                        // iteration to properly match up the keyed target element with its matching
                        // element in the original tree
                        isCompatible = false
                      }
                      else {
                        // We found a matching keyed element somewhere in the original DOM tree.
                        // Let's move the original DOM node into the current position and morph
                        // it.

                        // NOTE: We use insertBefore instead of replaceChild because we want to go through
                        // the `removeNode()` function for the node that is being discarded so that
                        // all lifecycle hooks are correctly invoked
                        fromEl.insertBefore(matchingFromEl, curFromNodeChild)

                        // fromNextSibling = curFromNodeChild.nextSibling;

                        if (curFromNodeKey) {
                          // Since the node is keyed it might be matched up later so we defer
                          // the actual removal to later
                          addKeyedRemoval(curFromNodeKey)
                        }
                        else {
                          // NOTE: we skip nested keyed nodes from being removed since there is
                          //       still a chance they will be matched up later
                          removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
                        }

                        curFromNodeChild = matchingFromEl
                        curFromNodeKey = getNodeKey(curFromNodeChild)
                      }
                    }
                    else {
                      // The nodes are not compatible since the "to" node has a key and there
                      // is no matching keyed node in the source tree
                      isCompatible = false
                    }
                  }
                }
                else if (curFromNodeKey) {
                  // The original has a key
                  isCompatible = false
                }

                isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild)
                if (isCompatible) {
                  // We found compatible DOM elements so transform
                  // the current "from" node to match the current
                  // target DOM node.
                  // MORPH
                  morphEl(curFromNodeChild, curToNodeChild)
                }
              }
              else if (curFromNodeType === TEXT_NODE || curFromNodeType === COMMENT_NODE) {
                // Both nodes being compared are Text or Comment nodes
                isCompatible = true
                // Simply update nodeValue on the original node to
                // change the text value
                if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                  curFromNodeChild.nodeValue = curToNodeChild.nodeValue
                }
              }
            }

            if (isCompatible) {
              // Advance both the "to" child and the "from" child since we found a match
              // Nothing else to do as we already recursively called morphChildren above
              curToNodeChild = toNextSibling
              curFromNodeChild = fromNextSibling
              foundMatch = true
              break
            }

            // No compatible match so remove the old node from the DOM and continue trying to find a
            // match in the original DOM. However, we only do this if the from node is not keyed
            // since it is possible that a keyed node might match up with a node somewhere else in the
            // target tree and we don't want to discard it just yet since it still might find a
            // home in the final DOM tree. After everything is done we will remove any keyed nodes
            // that didn't find a home
            if (curFromNodeKey) {
              // Since the node is keyed it might be matched up later so we defer
              // the actual removal to later
              addKeyedRemoval(curFromNodeKey)
            }
            else {
              // NOTE: we skip nested keyed nodes from being removed since there is
              //       still a chance they will be matched up later
              removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
            }

            curFromNodeChild = fromNextSibling
          } // END: while(curFromNodeChild) {}

          // If we got this far then we did not find a candidate match for
          // our "to node" and we exhausted all of the children "from"
          // nodes. Therefore, we will just append the current "to" node
          // to the end
          matchingFromEl = fromNodesLookup[curToNodeKey]
          if (curToNodeKey && matchingFromEl && compareNodeNames(matchingFromEl, curToNodeChild)) {
            // MORPH
            if (!skipFrom) {
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

              if (curToNodeChild.actualize) {
                curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc)
              }
              addChild(fromEl, curToNodeChild)
              handleNodeAdded(curToNodeChild)
            }
          }

          if (foundMatch) {
            curToNodeChild = toNextSibling
            curFromNodeChild = fromNextSibling
          }
          else {
            curToNodeChild = toNextSibling
            curFromNodeChild = fromNextSibling
          }
        }

        cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey)

        const specialElHandler = specialElHandlers[fromEl.nodeName]
        if (specialElHandler) {
          specialElHandler(fromEl, toEl)
        }
      } // END: morphChildren(...)

      let morphedNode = fromNode
      const morphedNodeType = morphedNode.nodeType
      const toNodeType = toNode.nodeType

      if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
          if (toNodeType === ELEMENT_NODE) {
            if (!compareNodeNames(fromNode, toNode)) {
              onNodeDiscarded(fromNode)
              morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI))
            }
          }
          else {
            // Going from an element node to a text node
            morphedNode = toNode
          }
        }
        else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // Text or comment node
          if (toNodeType === morphedNodeType) {
            if (morphedNode.nodeValue !== toNode.nodeValue) {
              morphedNode.nodeValue = toNode.nodeValue
            }

            return morphedNode
          }
          else {
            // Text node to something else
            morphedNode = toNode
          }
        }
      }

      if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode)
      }
      else {
        if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
          return
        }

        morphEl(morphedNode, toNode, childrenOnly)

        // We now need to loop over any keyed nodes that might need to be
        // removed. We only do the removal if we know that the keyed node
        // never found a match. When a keyed node is matched up we remove
        // it out of fromNodesLookup and we use fromNodesLookup to determine
        // if a keyed node has been matched up or not
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
        if (morphedNode.actualize) {
          morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc)
        }
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode)
      }

      return morphedNode
    }
  }

  return morphdomFactory(morphAttrs)
})()

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

// 初始化mermaid
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
  catch (error) {
    console.error('Mermaid 初始化失败:', error)
  }
}

// 渲染所有mermaid图表
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
      // 使用最新的mermaid API
      if (typeof mermaid !== 'undefined') {
        // eslint-disable-next-line no-undef
        mermaid.render(graphId, graphDefinition).then(({ svg }) => {
          element.innerHTML = svg
        }).catch((error) => {
          console.error('Mermaid render error:', error)
          element.innerHTML = `<pre style="color: red;">Mermaid渲染错误: ${error.message}</pre>`
        })
      }
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

// 监听VSCode消息
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
