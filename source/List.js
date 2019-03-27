import React from 'react'
import Masonry from './Masonry'


export default ({rowWidth, rowGutter, ...props}) => <Masonry
  role='list'
  {...props}
  columnGutter={rowGutter}
  columnWidth={rowWidth}
  columnCount={1}
/>