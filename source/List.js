import React from 'react'
import Masonry from './Masonry'


export default ({rowWidth, rowSpacer, ...props}) => <Masonry
  {...props}
  columnSpacer={rowSpacer}
  columnWidth={rowWidth}
  columnCount={1}
/>