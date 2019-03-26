export default (columnCount, columnWidth, columnGutter = 0) => {
  // Track the height of each column.
  // Layout algorithm below always inserts into the shortest column.
  const columnHeights = []

  for (let i = 0; i < columnCount; i++) {
    columnHeights[i] = 0
  }

  function cellPositioner (height = 0) {
    // Find the shortest column and use it.
    let columnIndex = 0

    for (let i = 1; i < columnHeights.length; i++) {
      if (columnHeights[i] < columnHeights[columnIndex]) {
        columnIndex = i
      }
    }

    const left = columnIndex * (columnWidth + columnGutter)
    const top = columnHeights[columnIndex] || 0
    columnHeights[columnIndex] = top + height + columnGutter
    return {left, top}
  }

  return cellPositioner
}
