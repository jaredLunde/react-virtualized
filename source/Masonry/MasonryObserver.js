import React from 'react'


const props = {
  // container element props
  id,
  className,
  style,
  role,
  'aria-label': '',
  tabIndex,

  // item rendering
  items,
  getItemKey,
  overscanHeight,
  children,

  // columns
  columnWidth,  // minimum column width
  columnGutter, // gutter size in px
  columnCount,  // overrides derived column count

  // events
  onRender,
}