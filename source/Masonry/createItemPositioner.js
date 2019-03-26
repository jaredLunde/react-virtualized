export default (columnCount, columnWidth, columnGutter = 0) => {
  // Track the height of each column.
  // Layout algorithm below always inserts into the shortest column.
  let columnHeights = []
  const items = new Map()
  const columnItems = []

  for (let i = 0; i < columnCount; i++) {
    columnHeights[i] = 0
    columnItems[i] = []
  }

  const set = (index, height = 0) => {
    // Find the shortest column and use it.
    let column = 0

    for (let i = 1; i < columnHeights.length; i++) {
      if (columnHeights[i] < columnHeights[column]) {
        column = i
      }
    }

    const left = column * (columnWidth + columnGutter)
    const top = columnHeights[column] || 0
    columnHeights[column] = top + height + columnGutter
    const item = {left, top, height, column}
    items.set(index, item)
    columnItems[column].push(index)
    return item
  }

  const update = updates => {
    let columns = {}, updatedItems = [], i = 0, j = 0

    for (; i < updates.length; i++) {
      const index = updates[i][0]
      const item = items.get(index)
      item.height = updates[i][1]
      columns[item.column] = Math.min(index, columns[item.column] || Infinity)
    }

    const columnNums = Object.keys(columns)

    for (i = 0; i < columnNums.length; i++) {
      const column = columnNums[i]
      const itemsInColumn = columnItems[column]
      const startIndex = itemsInColumn.indexOf(columns[column])
      const index = columnItems[column][startIndex]
      const startItem = items.get(index)
      columnHeights[column] = startItem.top + startItem.height + columnGutter
      updatedItems.push([index, startItem])

      for (j = startIndex + 1; j < itemsInColumn.length; j++) {
        const index = itemsInColumn[j]
        const item = items.get(index)
        item.top = columnHeights[column]
        columnHeights[column] = item.top + item.height + columnGutter
        updatedItems.push([index, item])
      }
    }

    return updatedItems
  }

  return {set, get: items.get.bind(items), update}
}
