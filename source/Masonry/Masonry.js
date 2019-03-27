import React, {useCallback, useMemo, useEffect, useRef} from 'react'
import emptyArr from 'empty/array'
import ResizeObserver from 'resize-observer-polyfill'
import {strictShallowEqual} from '@render-props/utils'
import trieMemoize from 'trie-memoize'
import memoizeOne from '../utils/memoizeOne'
import OneKeyMap from '../utils/OneKeyMap'
import createItemPositioner from './createItemPositioner'
import createPositionCache from './createPositionCache'
import useWindowScroller from './useWindowScroller'
import useContainerRect from './useContainerRect'


const props = {
  // sizing for SSR
  initialWidth: '',
  initialHeight: '',

  // events
  onRender: '',
}

export const getColumns = (containerWidth = 0, minimumWidth = 0, gutter = 8, columnCount) => {
  columnCount = columnCount || Math.floor(containerWidth / (minimumWidth + gutter)) || 1
  const columnWidth = Math.floor((containerWidth - (gutter * (columnCount - 1))) / columnCount)
  return [columnWidth, columnCount]
}

const getContainerStyle = memoizeOne(
  (isScrolling, estimateTotalHeight) => ({
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    height: estimateTotalHeight,
    maxHeight: estimateTotalHeight,
    willChange: 'contents',
    // willChange: 'contents',
    pointerEvents: isScrolling ? 'none' : '',
    contain: 'strict'
  }),
)

const assignUserStyle = memoizeOne(
  (containerStyle, userStyle) => ({...containerStyle, ...userStyle})
)
const assignUserItemStyle = trieMemoize(
  [WeakMap, OneKeyMap],
  (itemStyle, userStyle) => ({...itemStyle, ...userStyle})
)
const defaultGetItemKey = (_, i) => i
// tge below memoizations for for ensuring shallow equal is reliable for pure
// component children
const getCachedSize = memoizeOne(
  width => ({
    width,
    zIndex: -1000,
    visibility: 'hidden',
    position: 'absolute'
  })
)
const getCachedItemStyle = trieMemoize(
  [OneKeyMap, Map, Map],
  (width, left, top) => ({top, left, width, position: 'absolute'})
)

const SizeObserver = props => {
  const element = useRef(null)
  useEffect(
    () => () => element.current !== null && props.resizeObserver.unobserve(element.current),
    emptyArr
  )
  const ref = useCallback(
    el => {
      element.current = el
      props.observerRef(el)
    },
    [props.observerRef]
  )
  const elementProps = useMemo(() => ({ref, style: props.style}), [props.style, ref])
  return React.createElement(props.as, elementProps, props.children)
}

class Masonry extends React.Component {
  static defaultProps = {
    tabIndex: 0,
    role: 'grid',
    columnWidth: 300,  // minimum column width
    columnGutter: 0, // gutter size in px
    getItemKey: defaultGetItemKey,
    estimatedItemHeight: 300,
    overscanBy: 1
  }

  constructor (props) {
    super(props)
    this.itemElements = new WeakMap()
    this.resizeObserver = new ResizeObserver(entries => {
      let updates = []

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]

        if (entry.contentRect.height > 0) {
          const
            index = this.itemElements.get(entry.target),
            height = entry.target.offsetHeight

          if (height !== this.itemPositioner.get(index).height) {
            updates.push(index, height)
          }
        }
      }

      if (updates.length > 0) {
        this.updatePositions(updates)
      }
    })
    this.prevStartIndex = 0
    this.initPositioner()
    this.positionCache = createPositionCache()
  }

  componentWillUnmount () {
    this.resizeObserver.disconnect()
  }

  shouldComponentUpdate (nextProps) {
    if (
      nextProps.containerWidth !== this.props.containerWidth
      || nextProps.columnCount !== this.props.columnCount
      || nextProps.columnWidth !== this.props.columnWidth
      || nextProps.columnGutter !== this.props.columnGutter
    ) {
      this.repopulatePositions(nextProps)
      return true
    }

    return strictShallowEqual(nextProps, this.props) === false
  }

  componentDidUpdate () {
    // calls the onRender callback if the rendered indices changed
    if (
      typeof this.props.onRender === 'function'
      && this.stopIndex !== void 0
      && (this.prevStartIndex !== this.startIndex || this.prevStopIndex !== this.stopIndex)
    ) {
      this.props.onRender(this.startIndex, this.stopIndex, this.props.items)
      this.prevStartIndex = this.startIndex
      this.prevStopIndex = this.stopIndex
    }
  }

  initPositioner (props = this.props) {
    let [columnWidth, columnCount] = getColumns(
      props.containerWidth,
      props.columnWidth,
      props.columnGutter,
      props.columnCount,
    )
    this.columnWidth = columnWidth
    this.columnCount = columnCount
    this.columnGutter = props.columnGutter
    this.itemPositioner = createItemPositioner(columnCount, columnWidth, props.columnGutter)
  }

  repopulatePositions = (props = this.props) => {
    const prevPositioner = this.itemPositioner
    this.initPositioner(props)
    const nextPositionCache = createPositionCache()

    for (let index = 0; index < this.positionCache.getSize(); index++) {
      const height = prevPositioner.get(index).height
      const item = this.itemPositioner.set(index, height)
      nextPositionCache.setPosition(index, item.left, item.top, height)
    }

    this.positionCache = nextPositionCache
  }

  updatePositions = updates => {
    let updatedItems = this.itemPositioner.update(updates), i = 0

    for (; i < updatedItems.length - 1; i++) {
      const index = updatedItems[i], item = updatedItems[++i]
      this.positionCache.updatePosition(index, item.left, item.top, item.height)
    }

    this.forceUpdate()
  }

  clearPositions = () => {
    this._positionCache = createPositionCache()
    this.forceUpdate()
  }

  setItemRef = trieMemoize(
    [Map],
    index => el => {
      if (this.resizeObserver !== null && el !== null) {
        if (this.itemElements.get(el) === void 0) {
          this.itemElements.set(el, index)
          this.resizeObserver.observe(el)
        }

        if (this.itemPositioner.get(index) === void 0) {
          const height = el.offsetHeight
          const item = this.itemPositioner.set(index, height)
          this.positionCache.setPosition(index, item.left, item.top, height)
        }
      }
    }
  )

  render () {
    let {
      // container element props
      as = 'div', // container node type
      id,
      className,
      style,
      role,
      tabIndex,
      containerRef,

      items,
      estimatedItemHeight,
      getItemKey,
      overscanBy,

      scrollTop,
      isScrolling,
      windowHeight,

      render,
      renderAs = 'div',
      itemStyle,
      children: renderChildren
    } = this.props
    overscanBy = windowHeight * overscanBy
    render = renderChildren || render
    const
      children = [],
      itemCount = items.length,
      measuredCount = this.positionCache.getSize(),
      shortestColumnSize = this.positionCache.getShortestColumnSize()
    let nextStartIndex = 0, nextStopIndex

    this.positionCache.range(
      Math.max(0, scrollTop - overscanBy),
      (windowHeight * 2) + overscanBy,
      (index, left, top) => {
        if (nextStopIndex === void 0) {
          nextStartIndex = index
          nextStopIndex = index
        }
        else {
          nextStartIndex = Math.min(nextStartIndex, index)
          nextStopIndex = Math.max(nextStopIndex, index)
        }

        const
          data = items[index],
          key = getItemKey(data, index),
          observerStyle = getCachedItemStyle(this.columnWidth, left, top)

        children.push(
          React.createElement(
            SizeObserver,
            {
              key,
              as: renderAs,
              resizeObserver: this.resizeObserver,
              observerRef: this.setItemRef(index),
              style: typeof itemStyle === 'object' && itemStyle !== null
                ? assignUserItemStyle(observerStyle, itemStyle)
                : observerStyle,
            },
            React.createElement(
              render,
              {
                key,
                index,
                data,
                width: this.columnWidth
              }
            )
          )
        )
      },
    )

    this.startIndex = nextStartIndex
    // this may change below if there are more cells to render
    this.stopIndex = nextStopIndex

    if (
      shortestColumnSize < (scrollTop + windowHeight + overscanBy)
      && measuredCount < itemCount
    ) {
      const batchSize = Math.min(
        itemCount - measuredCount,
        Math.ceil(
          (scrollTop + windowHeight + overscanBy - shortestColumnSize)
          / estimatedItemHeight
          * this.columnCount,
        ),
      )

      let index = measuredCount

      for (; index < measuredCount + batchSize; index++) {
        const
          data =  items[index],
          key = getItemKey(data, index),
          columnNum = (index % this.columnCount) + 1
        const observerStyle = getCachedSize(this.columnWidth)

        children.push(
          React.createElement(
            SizeObserver,
            {
              key,
              as: renderAs,
              resizeObserver: this.resizeObserver,
              observerRef: this.setItemRef(index),
              style: typeof itemStyle === 'object' && itemStyle !== null
                ? assignUserItemStyle(observerStyle, itemStyle)
                : observerStyle
            },
            React.createElement(
              render,
              {
                key,
                index,
                data,
                width: this.columnWidth,
              }
            )
          ),
        )
      }

      this.stopIndex = index
    }
    // gets the container style object based upon the estimated height and whether or not
    // the page is being scrolled
    const containerStyle = getContainerStyle(
      isScrolling,
      this.positionCache.estimateTotalHeight(itemCount, this.columnCount, estimatedItemHeight)
    )

    return React.createElement(
      as,
      {
        ref: containerRef,
        id,
        role,
        className,
        tabIndex,
        style: typeof style === 'object' && style !== null
          ? assignUserStyle(containerStyle, style)
          : containerStyle,
        children
      }
    )
  }
}

export default React.memo(
  React.forwardRef(
    (props, ref) => {
      const {windowWidth, windowHeight, scrollY, isScrolling} = useWindowScroller()
      const [containerRef, containerWidth, top] = useContainerRect(windowWidth, windowHeight)

      return React.createElement(
        Masonry,
        {
          scrollTop: Math.max(0, scrollY - top),
          isScrolling,
          containerWidth,
          windowHeight,
          containerRef,
          ...props,
          ref
        }
      )
    }
  )
)