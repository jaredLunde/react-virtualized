import React, {useCallback, useEffect, useRef} from 'react'
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
    // willChange: 'contents transform',
    willChange: 'contents',
    pointerEvents: isScrolling ? 'none' : '',
    contain: 'strict'
  }),
)

const assignUserStyle = memoizeOne(
  (containerStyle, userStyle) => ({...containerStyle, ...userStyle})
)

const defaultGetItemKey = (_, i) => i
// tge below memoizations for for ensuring shallow equal is reliable for pure
// component children
const getCachedSize = memoizeOne((width, height) => ({width, height}))
const getCachedItemStyle = trieMemoize(
  [OneKeyMap, Map, Map],
  (width, left, top) => ({top, left, width, position: 'absolute'})
)
/*
const ObservationManager = props => {
  const element = useRef(null)
  useEffect(() => () => props.resizeObserver.unobserve(element), emptyArr)
  // useCallback(() => props.setItemRef)
  return React.createElement(props.children, props.childProps)
}
*/

class Masonry extends React.Component {
  static defaultProps = {
    tabIndex: 0,
    role: 'grid',
    columnWidth: 300,  // minimum column width
    columnGutter: 8, // gutter size in px
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
          const index = this.itemElements.get(entry.target)
          const height = entry.target.offsetHeight

          if (height !== this.itemPositioner.get(index).height) {
            updates.push([index, height])
          }
        }
      }

      if (updates.length > 0) {
        this.updatePositions(updates)
      }
    })

    this.initPositioner(props)
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

  initPositioner ({containerWidth, columnWidth, columnGutter, columnCount}) {
    let [nextColumnWidth, nextColumnCount] = getColumns(
      containerWidth,
      columnWidth,
      columnGutter,
      columnCount,
    )
    this.columnWidth = nextColumnWidth
    this.columnCount = nextColumnCount
    this.columnGutter = columnGutter
    this.itemPositioner = createItemPositioner(nextColumnCount, nextColumnWidth, columnGutter)
  }

  repopulatePositions = (props) => {
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
    const updatedItems = this.itemPositioner.update(updates)

    for (let i = 0; i < updatedItems.length; i++) {
      const [index, item] = updatedItems[i]
      this.positionCache.updatePosition(index, item.left, item.top, item.height)
    }

    this.forceUpdate()
  }

  setItemRef = trieMemoize(
    [Map, OneKeyMap],
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

      children: renderItem
    } = this.props
    overscanBy = windowHeight * overscanBy
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

        const data = items[index]
        const key = getItemKey(data, index)
        children.push(
          React.createElement(
            renderItem,
            {
              key,
              index,
              data,
              domRef: this.setItemRef(index),
              style: getCachedItemStyle(this.columnWidth, left, top)
            }
          )
        )
      },
    )

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
        const data =  items[index]
        const key = getItemKey(data, index)

        children.push(
          React.createElement(
            renderItem,
            {
              key,
              index,
              data,
              domRef: this.setItemRef(index),
              style: getCachedSize(this.columnWidth)
            }
          ),
        )
      }
      // stopIndex = index
    }
    // gets the container style object based upon the estimated height and whether or not
    // the page is being scrolled
    const containerStyle = getContainerStyle(
      isScrolling,
      this.positionCache.estimateTotalHeight(itemCount, this.columnCount, estimatedItemHeight)
    )

    return (
      <div
        ref={containerRef}
        id={id}
        className={className}
        style={
          typeof style === 'object' && style !== null
            ? assignUserStyle(containerStyle, style)
            : containerStyle
        }
        role={role}
        tabIndex={tabIndex}
      >
        {children}
      </div>
    )
  }
}

export default React.memo(
  React.forwardRef(
    (props, ref) => {
      const {windowWidth, windowHeight, scrollY, isScrolling} = useWindowScroller()
      const [containerRef, containerWidth, top] = useContainerRect(windowWidth, windowHeight)
      const scrollTop = Math.max(0, scrollY - top)

      return React.createElement(
        Masonry,
        {
          scrollTop,
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