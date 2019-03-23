/** @flow */

import type {CellMeasureCache} from './types'


export const DEFAULT_HEIGHT = 30
export const DEFAULT_WIDTH = 100

// Enables more intelligent mapping of a given column and row index to an item ID.
// This prevents a cell cache from being invalidated when its parent collection is modified.
type KeyMapper = (rowIndex: number, columnIndex: number) => any;

type CellMeasurerCacheParams = {
  defaultHeight?: number,
  defaultWidth?: number,
  fixedHeight?: boolean,
  fixedWidth?: boolean,
  minHeight?: number,
  minWidth?: number,
  keyMapper?: KeyMapper,
};

type Cache = {
  [key: any]: number,
};

type IndexParam = {
  index: number,
};

/**
 * Caches measurements for a given cell.
 */
export default class CellMeasurerCache implements CellMeasureCache {
  _cellHeightCache: Cache = {}
  _cellWidthCache: Cache = {}
  _columnWidthCache: Cache = {}
  _rowHeightCache: Cache = {}
  defaultHeight: number
  defaultWidth: number
  _minHeight: number
  _minWidth: number
  _keyMapper: KeyMapper
  hasFixedHeight: boolean
  hasFixedWidth: boolean
  _columnCount = 0
  _rowCount = 0

  constructor (params: CellMeasurerCacheParams = {}) {
    const {
      defaultHeight,
      defaultWidth,
      fixedHeight,
      fixedWidth,
      keyMapper,
      minHeight,
      minWidth,
    } = params

    this.hasFixedHeight = fixedHeight === true
    this.hasFixedWidth = fixedWidth === true
    this._minHeight = minHeight || 0
    this._minWidth = minWidth || 0
    this._keyMapper = keyMapper || defaultKeyMapper
    this.defaultHeight = Math.max(
      this._minHeight,
      typeof defaultHeight === 'number' ? defaultHeight : DEFAULT_HEIGHT,
    )
    this.defaultWidth = Math.max(
      this._minWidth,
      typeof defaultWidth === 'number' ? defaultWidth : DEFAULT_WIDTH,
    )

    if (process.env.NODE_ENV !== 'production') {
      if (this.hasFixedHeight === false && this.hasFixedWidth === false) {
        console.warn(
          'CellMeasurerCache should only measure a cell\'s width or height. ' +
          'You have configured CellMeasurerCache to measure both. ' +
          'This will result in poor performance.',
        )
      }

      if (this.hasFixedHeight === false && this.defaultHeight === 0) {
        console.warn(
          'Fixed height CellMeasurerCache should specify a :defaultHeight greater than 0. ' +
          'Failing to do so will lead to unnecessary layout and poor performance.',
        )
      }

      if (this.hasFixedWidth === false && this.defaultWidth === 0) {
        console.warn(
          'Fixed width CellMeasurerCache should specify a :defaultWidth greater than 0. ' +
          'Failing to do so will lead to unnecessary layout and poor performance.',
        )
      }
    }
  }

  clear (rowIndex: number, columnIndex: number = 0) {
    const key = this._keyMapper(rowIndex, columnIndex)
    delete this._cellHeightCache[key]
    delete this._cellWidthCache[key]

    this._updateCachedColumnAndRowSizes(rowIndex, columnIndex)
  }

  clearAll () {
    this._cellHeightCache = {}
    this._cellWidthCache = {}
    this._columnWidthCache = {}
    this._rowHeightCache = {}
    this._rowCount = 0
    this._columnCount = 0
  }

  columnWidth = ({index}: IndexParam) => {
    const key = this._keyMapper(0, index)
    return this._columnWidthCache[key] !== void 0
      ? this._columnWidthCache[key]
      : this.defaultWidth
  }

  rowHeight = ({index}: IndexParam) => {
    const key = this._keyMapper(index, 0)
    return this._rowHeightCache[key] !== void 0
      ? this._rowHeightCache[key]
      : this.defaultHeight
  }

  getWidth (rowIndex: number, columnIndex: number = 0): number {
    if (this.hasFixedWidth) {
      return this.defaultWidth
    }
    else {
      const key = this._keyMapper(rowIndex, columnIndex)
      return this._cellWidthCache[key] !== void 0
        ? Math.max(this._minWidth, this._cellWidthCache[key])
        : this.defaultWidth
    }
  }

  getHeight (rowIndex: number, columnIndex: number = 0): number {
    if (this.hasFixedHeight) {
      return this.defaultHeight
    }
    else {
      const key = this._keyMapper(rowIndex, columnIndex)
      return this._cellHeightCache[key] !== void 0
        ? Math.max(this._minHeight, this._cellHeightCache[key])
        : this.defaultHeight
    }
  }

  has (rowIndex: number, columnIndex: number = 0): boolean {
    const key = this._keyMapper(rowIndex, columnIndex)
    return this._cellHeightCache[key] !== void 0
  }

  set (
    rowIndex: number,
    columnIndex: number,
    width: number,
    height: number,
  ): void {
    const key = this._keyMapper(rowIndex, columnIndex)

    if (columnIndex >= this._columnCount) {
      this._columnCount = columnIndex + 1
    }
    if (rowIndex >= this._rowCount) {
      this._rowCount = rowIndex + 1
    }

    // Size is cached per cell so we don't have to re-measure if cells are re-ordered.
    this._cellHeightCache[key] = height
    this._cellWidthCache[key] = width
    this._updateCachedColumnAndRowSizes(rowIndex, columnIndex)
  }

  _updateCachedColumnAndRowSizes (rowIndex: number, columnIndex: number) {
    // :columnWidth and :rowHeight are derived based on all cells in a column/row.
    // Pre-cache these derived values for faster lookup later.
    // Reads are expected to occur more frequently than writes in this case.
    // Only update non-fixed dimensions though to avoid doing unnecessary work.
    if (!this.hasFixedWidth) {
      let columnWidth = 0, i = 0
      for (; i < this._rowCount; i++) {
        columnWidth = Math.max(columnWidth, this.getWidth(i, columnIndex))
      }
      const columnKey = this._keyMapper(0, columnIndex)
      this._columnWidthCache[columnKey] = columnWidth
    }
    if (!this.hasFixedHeight) {
      let rowHeight = 0, i = 0
      for (; i < this._columnCount; i++) {
        rowHeight = Math.max(rowHeight, this.getHeight(rowIndex, i))
      }
      const rowKey = this._keyMapper(rowIndex, 0)
      this._rowHeightCache[rowKey] = rowHeight
    }
  }
}

const defaultKeyMapper = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`