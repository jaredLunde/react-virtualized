import React from 'react'
import ResizeObserver from 'resize-observer-polyfill'
import {strictShallowEqual} from '@render-props/utils'
import memoizeOne from '../utils/memoizeOne'
import createCellPositioner from './createCellPositioner'
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
  const columnWidth = Math.floor(
    columnCount > 1
      ? (containerWidth / columnCount) - gutter
      : containerWidth / columnCount
  )
  return [columnWidth, columnCount]
}

const getContainerStyle = memoizeOne(
  (isScrolling, estimateTotalHeight) => ({
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    height: estimateTotalHeight,
    maxHeight: estimateTotalHeight,
    overflow: 'hidden',
    willChange: 'contents',
    pointerEvents: isScrolling ? 'none' : ''
  }),
)

const assignUserStyle = memoizeOne(
  (containerStyle, userStyle) => ({...containerStyle, ...userStyle}),
  JSON.stringify
)

const defaultGetItemKey = i => i
const getCachedSize = memoizeOne((width, height) => ({width, height}))

class Masonry extends React.Component {
  static defaultProps = {
    columnWidth: 300,  // minimum column width
    columnGutter: 8, // gutter size in px
    getItemKey: defaultGetItemKey,
    defaultItemHeight: 300,
  }

  constructor (props) {
    super(props)
    this.itemElements = new WeakMap()
    this.itemSizes = new Map()
    this.resizeObserver = new ResizeObserver(entries => {
      let updates = []

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const index = this.itemElements.get(entry.target)
        const key = this.props.getItemKey(index, this.props.items)
        if (entry.contentRect.height > 0) {
          const height = entry.target.offsetHeight

          if (height !== this.itemSizes.get(key)) {
            updates.push(index)
            this.itemSizes.set(key, height)
            // TODO: Invalidate position cache
          }
        }
      }

      if (updates.length > 0) {
        console.log('Had updates?', updates)
        this.invalidatePositionCache(updates)
      }
    })
    let [columnWidth, columnCount] = getColumns(
      props.containerWidth,
      props.columnWidth,
      props.columnGutter,
      props.columnCount,
    )
    this.columnWidth = columnWidth
    this.columnCount = columnCount
    this.columnGutter = props.columnGutter
    this.cellPositioner = createCellPositioner(columnCount, columnWidth, this.columnGutter)
    this.positionCache = createPositionCache()
  }

  shouldComponentUpdate (nextProps) {
    if (
      nextProps.containerWidth !== this.props.containerWidth
      || nextProps.columnCount !== this.props.columnCount
      || nextProps.columnWidth !== this.props.columnWidth
      || nextProps.columnGutter !== this.props.columnGutter
    ) {
      let [columnWidth, columnCount] = getColumns(
        nextProps.containerWidth,
        nextProps.columnWidth,
        nextProps.columnGutter,
        nextProps.columnCount,
      )
      this.columnWidth = columnWidth
      this.columnCount = columnCount
      this.columnGutter = nextProps.columnGutter
      this.cellPositioner = createCellPositioner(columnCount, columnWidth, this.columnGutter)
      const nextPositionCache = createPositionCache()

      for (let index = 0; index < this.positionCache.getSize(); index++) {
        const height = this.itemSizes.get(nextProps.getItemKey(index, nextProps.items))
        const pos = this.cellPositioner(height)
        nextPositionCache.setPosition(index, pos.left, pos.top, height)
      }

      this.positionCache = nextPositionCache
      return true
    }

    return strictShallowEqual(nextProps, this.props) === false
  }

  componentWillUnmount () {
    this.resizeObserver.disconnect()
  }

  invalidatePositionCache = indices => {

  }

  setItemRef = (index, key) => el => {
    if (this.resizeObserver !== null && el !== null) {
      if (this.itemElements.get(el) === void 0) {
        this.resizeObserver.observe(el)
      }

      this.itemElements.set(el, index)

      if (this.itemSizes.get(key) === void 0) {
        const height = el.offsetHeight
        const {left, top} = this.cellPositioner(height)
        this.positionCache.setPosition(index, left, top, height)
        this.itemSizes.set(key, height)
      }
    }
  }

  render () {
    let {
      // container element props
      id,
      className,
      style,
      role = 'grid',
      tabIndex = 0,
      containerRef,

      items,
      defaultItemHeight,
      getItemKey,
      overscanBy,

      scrollTop,
      isScrolling,
      windowHeight,

      children: renderItem
    } = this.props
    overscanBy = overscanBy || (windowHeight * 2)
    const
      children = [],
      itemCount = items.length,
      measuredCount = this.positionCache.getSize(),
      shortestColumnSize = this.positionCache.getShortestColumnSize()
    let nextStartIndex = 0, nextStopIndex

    this.positionCache.range(
      Math.max(0, scrollTop - overscanBy),
      windowHeight + overscanBy * 2,
      (index, left, top) => {
        if (nextStopIndex === void 0) {
          nextStartIndex = index
          nextStopIndex = index
        }
        else {
          nextStartIndex = Math.min(nextStartIndex, index)
          nextStopIndex = Math.max(nextStopIndex, index)
        }

        const key = getItemKey(index, items)
        children.push(
          React.createElement(
            renderItem,
            {
              key,
              index,
              data: items[index],
              domRef: this.setItemRef(index, key),
              // domRef: resizeObserver(key),
              style: {
                top,
                left,
                width: this.columnWidth,
                // height: getItemSize(key),
                position: 'absolute',
              }
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
          / defaultItemHeight
          * this.columnCount,
        ),
      )

      let index = measuredCount

      for (; index < measuredCount + batchSize; index++) {
        const key = getItemKey(index, items)

        children.push(
          React.createElement(
            renderItem,
            {
              key,
              index,
              // we should only need to add the dom ref on the initial mount
              domRef: this.setItemRef(index, key),
              data: items[index],
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
      this.positionCache.estimateTotalHeight(itemCount, this.columnCount, defaultItemHeight)
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
          ...props,
          containerRef,
          containerWidth,
          windowWidth,
          windowHeight,
          scrollTop,
          isScrolling,
          ref
        }
      )
    }
  )
)