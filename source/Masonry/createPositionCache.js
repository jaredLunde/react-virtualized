import IntervalTree from './IntervalTree'

// Position cache requirements:
//   O(log(n)) lookup of cells to render for a given viewport size
//   O(1) lookup of shortest measured column (so we know when to enter phase 1)
const createPositionCache = () => {
  let count = 0
  // Store tops and bottoms of each cell for fast intersection lookup.
  let intervalTree = new IntervalTree()
  // Tracks the intervals that were inserted into the interval tree so they can be
  // removed when positions are updated
  let cachedIntervals = new Map()
  // Maps cell index to x coordinates for quick lookup.
  let leftMap = new Map()
  // Tracks the height of each column
  let columnSizeMap  = {}

  const estimateTotalHeight = (itemCount, columnCount, defaultItemHeight) => (
    getTallestColumnSize()
    + Math.ceil((itemCount - count) / columnCount)
    * defaultItemHeight
  )

  // Render all cells visible within the viewport range defined.
  const range = (scrollTop, clientHeight, renderCallback) => {
    intervalTree.queryInterval(
      scrollTop,
      scrollTop + clientHeight,
      ([top, _, index]) => renderCallback(index, leftMap.get(index), top),
    )
  }

  const setPosition = (index, left, top, height) => {
    const interval = [top, top + height, index]
    intervalTree.insert(interval)
    cachedIntervals.set(index, interval)
    leftMap.set(index, left)
    const columnHeight = columnSizeMap[left]

    if (columnHeight === void 0) {
      height = top + height
      columnSizeMap[left] = height
    }
    else {
      height = Math.max(columnHeight, top + height)
      columnSizeMap[left] = height
    }

    count = intervalTree.count
  }

  const updatePosition = (index, left, top, height) => {
    const
      prevInterval = cachedIntervals.get(index),
      prev = prevInterval[1],
      next = top + height

    intervalTree.remove(prevInterval)
    const interval = [top, next, index]
    intervalTree.insert(interval)
    cachedIntervals.set(index, interval)

    const columnHeight = columnSizeMap[left]

    if (prev > next) {
      if (columnSizeMap[left] === prev) {
        columnSizeMap[left] = next
      }
    }
    else {
      columnSizeMap[left] = Math.max(columnHeight, next)
    }
  }

  const getShortestColumnSize = () => {
    let keys = Object.keys(columnSizeMap),
      size = columnSizeMap[keys[0]],
      i = 1

    if (size !== void 0 && keys.length > 1) {
      for (; i < keys.length; i++) {
        let height = columnSizeMap[keys[i]]
        size = size < height ? size : height
      }
    }

    return size || 0
  }

  const getTallestColumnSize = () => Math.max(
    0,
    Math.max.apply(null, Object.values(columnSizeMap))
  )

  return {
    range,
    getSize: () => count,
    estimateTotalHeight,
    getShortestColumnSize,
    setPosition,
    updatePosition
  }
}

export default createPositionCache
