/** @flow */
import * as React from 'react'
import type {CellMeasureCache} from './types'


type Children = (params: { measure: () => void }) => React.Element<*>;

type Cell = (
  columnIndex: number,
  rowIndex: number,
) => void;

type Props = {
  cache: CellMeasureCache,
  children: Children | React.Element<*>,
  columnIndex?: number,
  index?: number,
  parent: {
    invalidateCellSizeAfterRender?: Cell,
    recomputeGridSize?: Cell,
  },
  rowIndex?: number,
};

/**
 * Wraps a cell and measures its rendered content.
 * Measurements are stored in a per-cell cache.
 * Cached-content is not be re-measured.
 */
export default class CellMeasurer extends React.PureComponent<Props> {
  static __internalCellMeasurerFlag = false
  node = React.createRef()

  componentDidMount () {
    this._maybeMeasureCell()
  }

  componentDidUpdate () {
    this._maybeMeasureCell()
  }

  render () {
    return this.props.children(this.node, this._measure)
  }

  _getCellMeasurements () {
    const {cache} = this.props,
          node = this.node.current

    if (node !== null) {
      const styleWidth = node.style.width,
            styleHeight = node.style.height

      if (!cache.hasFixedWidth) {
        node.style.width = 'auto'
      }

      if (!cache.hasFixedHeight) {
        node.style.height = 'auto'
      }

      const height = Math.ceil(node.offsetHeight),
            width = Math.ceil(node.offsetWidth)

      // Reset after measuring to avoid breaking styles; see #660
      if (styleWidth) {
        node.style.width = styleWidth
      }
      if (styleHeight) {
        node.style.height = styleHeight
      }

      return {width, height}
    }
    else {
      return {width: 0, height: 0}
    }
  }

  _maybeMeasureCell () {
    const {cache, parent, columnIndex = 0, rowIndex = this.props.index || 0} = this.props

    if (cache.has(rowIndex, columnIndex) === false) {
      const {width, height} = this._getCellMeasurements()
      cache.set(rowIndex, columnIndex, width, height)

      // If size has changed, let Grid know to re-render.
      if (typeof parent.invalidateCellSizeAfterRender === 'function') {
        parent.invalidateCellSizeAfterRender(rowIndex, columnIndex)
      }
    }
  }

  _measure = () => {
    const {cache, columnIndex = 0, rowIndex = this.props.index || 0} = this.props
    const {width, height} = this._getCellMeasurements()

    if (
      width !== cache.getWidth(rowIndex, columnIndex)
      || height !== cache.getHeight(rowIndex, columnIndex)
    ) {
      cache.set(rowIndex, columnIndex, width, height)
    }
  }
}

// Used for DEV mode warning check
if (process.env.NODE_ENV !== 'production') {
  CellMeasurer.__internalCellMeasurerFlag = true
}
