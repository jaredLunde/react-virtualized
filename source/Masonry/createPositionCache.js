import createIntervalTree from './intervalTree'

// Position cache requirements:
//   O(log(n)) lookup of cells to render for a given viewport size
//   O(1) lookup of shortest measured column (so we know when to enter phase 1)
const createPositionCache = () => {
  let count = 0
  // Tracks the height of each column
  let columnSizeMap  = {}
  // Store tops and bottoms of each cell for fast intersection lookup.
  let intervalTree = createIntervalTree()
  // Maps cell index to x coordinates for quick lookup.
  let leftMap = {}

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
      ([top, _, index]) => renderCallback(index, leftMap[index], top),
    )
  }

  const setPosition = (index, left, top, height) => {
    intervalTree.insert([top, top + height, index])
    leftMap[index] = left
    const columnHeight = columnSizeMap[left]

    if (columnHeight === undefined) {
      height = top + height
      columnSizeMap[left] = height
    }
    else {
      height = Math.max(columnHeight, top + height)
      columnSizeMap[left] = height
    }

    count = intervalTree.count
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
    getSize: () => count,
    range,
    estimateTotalHeight,
    getShortestColumnSize,
    getTallestColumnSize,
    setPosition
  }
}

export default createPositionCache
