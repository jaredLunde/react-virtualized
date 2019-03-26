import React, {useState, useCallback, useMemo, useEffect, useImperativeHandle, useRef} from 'react'
import ResizeObserver from 'resize-observer-polyfill'
import emptyArr from 'empty/array'
import useWindowScroller from './useWindowScroller'
import createCellPositioner from './createCellPositioner'
import createPositionCache from './createPositionCache'
import memoizeOne from '../utils/memoizeOne'


const props = {
  // sizing for SSR
  initialWidth: '',
  initialHeight: '',

  // events
  onRender: '',
}

export const getColumns = memoizeOne(
  (containerWidth = 0, minimumWidth = 0, gutter = 8, columnCount) => {
    columnCount = columnCount || Math.floor(containerWidth / (minimumWidth + gutter)) || 1
    const columnWidth = Math.floor(
      columnCount > 1
        ? (containerWidth / columnCount) - gutter
        : containerWidth / columnCount
    )
    return [columnWidth, columnCount]
  }
)

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
const createResizeObserver = (itemSizes, itemElements) => {
  console.log('Created RO')
  return new ResizeObserver(
    entries => {
      let hadUpdates = false

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const key = itemElements.get(entry.target)
        let height = Math.ceil(entry.contentRect.height + entry.contentRect.top)

        if (height > 0) {
          height = entry.target.offsetHeight
          if (height !== itemSizes.get(key)) {
            console.log('Updating size', key, height, itemSizes.get(key))
            hadUpdates = true
            itemSizes.set(key, height)
            // TODO: Invalidate position cache
          }
        }
      }

      if (hadUpdates === true) {
        console.log('Had updates?', hadUpdates)
      }
    }
  )
}

const Masonry = (
  {
    // container element props
    id,
    className,
    style,
    role = 'grid',
    tabIndex = 0,
    // column props
    columnWidth = 300,  // minimum column width
    columnGutter = 8, // gutter size in px
    columnCount,  // overrides derived column count
    // item rendering
    items,
    getItemKey = defaultGetItemKey,
    defaultItemHeight = 300,
    overscanBy,
    children: renderItem,
  },
  ref
) => {
  // creates a tracker which determines the window size/scroll properties and
  // information about the rect of the container
  const [containerRef, scrollerState] = useWindowScroller()
  const {containerWidth, windowHeight, scrollTop, isScrolling} = scrollerState
  overscanBy = overscanBy || windowHeight
  let [derivedColumnWidth, derivedColumnCount] = getColumns(
    containerWidth,
    columnWidth,
    columnGutter,
    columnCount,
  )
  // creates a cell positioner which determines the {top, left} properties of
  // underlying cells
  const cellPositioner = useRef(null)
  useEffect(
    () => {
      cellPositioner.current = createCellPositioner(
        derivedColumnCount,
        derivedColumnWidth,
        columnGutter
      )
    },
    [derivedColumnCount, derivedColumnWidth, columnGutter]
  )
  //tracks size changes to child elements
  const
    itemElements = useRef(new WeakMap()),
    itemSizes = useRef(new Map()),
    getItemSize = useCallback(
      i => itemSizes.current.get(getItemKey(i, items)),
      [itemSizes.current, getItemKey]
    )
  // creates a resize observer which tracks changes to item sizes
  const ro = useRef(null)
  useEffect(
    () => {
      ro.current = createResizeObserver(itemSizes.current, itemElements.current)
      return () => ro.current.disconnect()
    },
    [itemSizes.current, itemElements.current]
  )

  const
    positionCache = useRef(null),
    itemCount = items.length
  // creates the initial position cache
  useEffect(
    () => {
      positionCache.current = createPositionCache()
    },
    emptyArr
  )
  useEffect(
    () => {
      const nextPositionCache = createPositionCache()

      for (let index = 0; index <= positionCache.current.getSize(); index++) {
        const height = getItemSize(index) || defaultItemHeight
        const {left, top} = cellPositioner.current(height)
        console.log(
          'Updating position',
          getItemKey(index, items),
          left,
          top,
          height,
        )
        nextPositionCache.setPosition(getItemKey(index, items), left, top, height)
      }

      positionCache.current = nextPositionCache
    },
    [cellPositioner.current, derivedColumnCount, derivedColumnWidth, columnGutter]
  )
  const resizeObserver = useCallback(
    key => el => {
      if (ro.current !== null && el !== null) {
        if (itemElements.current.get(el) === void 0) {
          console.log('Updating ref', key)
          ro.current.observe(el)
        }

        itemElements.current.set(el, key)

        if (itemSizes.current.get(key) === void 0) {
          const height = el.offsetHeight
          const {left, top} = cellPositioner.current(height)
          console.log('Setting initial', key, left, top, height)
          positionCache.current.setPosition(key, left, top, height)
          itemSizes.current.set(key, height)
        }
      }
    },
    [ro.current, positionCache.current, cellPositioner.current]
  )
  console.log('Position cache:', positionCache.current && positionCache.current.getSize())
  /*
  useImperativeHandle(ref, () => ({
    clearCellPositions: () => {}
  }))
  */
  const children = []
  let shortestColumnSize = 0, measuredCount = 0

  if (positionCache.current !== null) {
    shortestColumnSize = positionCache.current.getShortestColumnSize()
    console.log('Shortest column:', shortestColumnSize)
    let nextStartIndex = 0, nextStopIndex
    positionCache.current.range(
      Math.max(0, scrollTop - overscanBy),
      windowHeight + overscanBy * 2,
      (index, left, top) => {
        console.log('Index', index, 'Left', left, 'Top', top)
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
              // domRef: resizeObserver(key),
              style: {
                top,
                left,
                width: derivedColumnWidth,
                // height: getItemSize(key),
                position: 'absolute',
              }
            }
          )
        )
      },
    )

    measuredCount = positionCache.current.getSize()
    console.log('Measured count', children)
  }

  if (
    shortestColumnSize < (scrollTop + windowHeight + overscanBy)
    && measuredCount < itemCount
  ) {
    const batchSize = Math.min(
      itemCount - measuredCount,
      Math.ceil(
        (scrollTop + windowHeight + overscanBy - shortestColumnSize)
        / defaultItemHeight
        * derivedColumnCount,
      ),
    )

    let index = measuredCount
    console.log('Creating children:', index, measuredCount + batchSize)
    for (; index < measuredCount + batchSize; index++) {
      const key = getItemKey(index, items)

      children.push(
        React.createElement(
          renderItem,
          {
            key,
            index,
            // we should only need to add the dom ref on the initial mount
            domRef: resizeObserver(key),
            data: items[index],
            style: getCachedSize(columnWidth)
          }
        ),
      )
    }
    // stopIndex = index
  }
  // gets the container style object based upon the estimated height and whether or not
  // the page is being scrolled
  let estimatedTotalHeight = 0
  if (positionCache.current !== null) {
    estimatedTotalHeight = positionCache.current.estimateTotalHeight(
      itemCount,
      derivedColumnCount,
      defaultItemHeight,
    )
    console.log('esttiim', positionCache.current.estimateTotalHeight())
  }
  const containerStyle = getContainerStyle(isScrolling, estimatedTotalHeight)

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

export default React.memo(React.forwardRef(Masonry))