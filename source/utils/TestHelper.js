/**
 * Initializes metadata for an axis and its cells.
 * This data is used to determine which cells are visible given a container size and scroll
 * position.
 *
 * @param cellCount Total number of cells.
 * @param size Either a fixed size or a function that returns the size for a given given an
 *   index.
 * @return Object mapping cell index to cell metadata (size, offset)
 */
export default function initCellMetadata ({cellCount, size}) {
  const sizeGetter = typeof size === 'function' ? size : () => size

  const cellMetadata = []
  let offset = 0

  for (var i = 0; i < cellCount; i++) {
    let size = sizeGetter({index: i})

    if (size == null || isNaN(size)) {
      throw Error(`Invalid size returned for cell ${i} of value ${size}`)
    }

    cellMetadata[i] = {
      size,
      offset,
    }

    offset += size
  }

  return cellMetadata
}

// Default cell sizes and offsets for use in below tests
export function getCellMetadata () {
  const cellSizes = [
    10, // 0: 0..0 (min)
    20, // 1: 0..10
    15, // 2: 0..30
    10, // 3: 5..45
    15, // 4: 20..55
    30, // 5: 50..70
    20, // 6: 70..100
    10, // 7: 80..110
    30, //  8: 110..110 (max)
  ]
  return initCellMetadata({
    cellCount: cellSizes.length,
    size: ({index}) => cellSizes[index],
  })
}
