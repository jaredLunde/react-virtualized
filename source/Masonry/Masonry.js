/** @flow */
import clsx from 'clsx';
import * as React from 'react';
import PositionCache from './PositionCache';
import memoizeOne from '../utils/memoizeOne'


type Props = {
  autoHeight: boolean,
  cellCount: number,
  cellMeasurerCache: CellMeasurerCache,
  cellPositioner: Positioner,
  cellRenderer: CellRenderer,
  className: ?string,
  height: number,
  id: ?string,
  keyMapper: KeyMapper,
  onCellsRendered: ?OnCellsRenderedCallback,
  overscanByPixels: number,
  role: string,
  isScrolling: boolean,
  scrollTop: number,
  style: mixed,
  tabIndex: number,
  width: number,
  rowDirection: string,
};

const getDefaultContainerStyle = memoizeOne(
  (isScrolling, width) => ({
    direction: 'ltr',
    height: 'auto',
    position: 'relative',
    width,
    pointerEvents: isScrolling ? 'none' : '',
  })
)
const getInnerStyle = memoizeOne(
  estimateTotalHeight => ({
    width: '100%',
    height: estimateTotalHeight,
    maxWidth: '100%',
    maxHeight: estimateTotalHeight,
    overflow: 'hidden',
    position: 'relative',
  })
)
/**
 * This component efficiently displays arbitrarily positioned cells using windowing techniques.
 * Cell position is determined by an injected `cellPositioner` property.
 * Windowing is vertical; this component does not support horizontal scrolling.
 *
 * Rendering occurs in two phases:
 * 1) First pass uses estimated cell sizes (provided by the cache) to determine how many cells
 * to measure in a batch. Batch size is chosen using a fast, naive layout algorithm that stacks
 * images in order until the viewport has been filled. After measurement is complete
 * (componentDidMount or componentDidUpdate) this component evaluates positioned cells in order
 * to determine if another measurement pass is required (eg if actual cell sizes were less than
 * estimated sizes). All measurements are permanently cached (keyed by `keyMapper`) for
 * performance purposes.
 * 2) Second pass uses the external `cellPositioner` to layout cells.
 *    At this time the positioner has access to cached size measurements for all cells.
 *    The positions it returns are cached by Masonry for fast access later.
 *    Phase one is repeated if the user scrolls beyond the current layout's bounds.
 *    If the layout is invalidated due to eg a resize, cached positions can be cleared using
 * `recomputeCellPositions()`.
 *
 * Animation constraints:
 *   Simple animations are supported (eg translate/slide into place on initial reveal).
 *   More complex animations are not (eg flying from one position to another on resize).
 *
 * Layout constraints:
 *   This component supports multi-column layout.
 *   The height of each item may vary.
 *   The width of each item must not exceed the width of the column it is "in".
 *   The left position of all items within a column must align.
 *   (Items may not span multiple columns.)
 */
class Masonry extends React.PureComponent<Props> {
  static defaultProps = {
    autoHeight: false,
    keyMapper: identity,
    onCellsRendered: noop,
    overscanByPixels: 20,
    role: 'grid',
    tabIndex: 0,
    rowDirection: 'ltr',
  };

  _invalidateOnUpdateStartIndex: ?number = null;
  _invalidateOnUpdateStopIndex: ?number = null;
  _positionCache: PositionCache = new PositionCache();
  _startIndex: ?number = null;
  _startIndexMemoized: ?number = null;
  _stopIndex: ?number = null;
  _stopIndexMemoized: ?number = null;

  clearCellPositions () {
    this._positionCache = new PositionCache();
    this.forceUpdate();
  }

  // HACK This method signature was intended for Grid
  invalidateCellSizeAfterRender (rowIndex) {
    if (this._invalidateOnUpdateStartIndex === null) {
      this._invalidateOnUpdateStartIndex = rowIndex;
      this._invalidateOnUpdateStopIndex = rowIndex;
    }
    else {
      this._invalidateOnUpdateStartIndex = Math.min(
        this._invalidateOnUpdateStartIndex,
        rowIndex,
      );
      this._invalidateOnUpdateStopIndex = Math.max(
        this._invalidateOnUpdateStopIndex,
        rowIndex,
      );
    }
  }

  recomputeCellPositions () {
    const stopIndex = this._positionCache.count - 1;
    this._positionCache = new PositionCache();
    this._populatePositionCache(0, stopIndex);
    this.forceUpdate();
  }

  componentDidMount () {
    this._checkInvalidateOnUpdate();
    this._invokeOnCellsRenderedCallback();
  }

  componentDidUpdate (prevProps: Props) {
    this._checkInvalidateOnUpdate();
    this._invokeOnCellsRenderedCallback();
  }

  _checkInvalidateOnUpdate () {
    if (typeof this._invalidateOnUpdateStartIndex === 'number') {
      const startIndex = this._invalidateOnUpdateStartIndex;
      const stopIndex = this._invalidateOnUpdateStopIndex;

      this._invalidateOnUpdateStartIndex = null;
      this._invalidateOnUpdateStopIndex = null;

      // Query external layout logic for position of newly-measured cells
      this._populatePositionCache(startIndex, stopIndex);

      this.forceUpdate();
    }
  }

  _getEstimatedTotalHeight () {
    const {cellCount, cellMeasurerCache, width} = this.props;

    const estimatedColumnCount = Math.max(
      1,
      Math.floor(width / cellMeasurerCache.defaultWidth),
    );

    return this._positionCache.estimateTotalHeight(
      cellCount,
      estimatedColumnCount,
      cellMeasurerCache.defaultHeight,
    );
  }

  _invokeOnCellsRenderedCallback () {
    if (
      this._startIndexMemoized !== this._startIndex ||
      this._stopIndexMemoized !== this._stopIndex
    ) {
      this.props.onCellsRendered(this._startIndex, this._stopIndex)
      this._startIndexMemoized = this._startIndex;
      this._stopIndexMemoized = this._stopIndex;
    }
  }

  _populatePositionCache (startIndex: number, stopIndex: number) {
    const {cellMeasurerCache, cellPositioner} = this.props;

    for (let index = startIndex; index <= stopIndex; index++) {
      const {left, top} = cellPositioner(index);

      this._positionCache.setPosition(
        index,
        left,
        top,
        cellMeasurerCache.getHeight(index),
      );
    }
  }

  render () {
    const {
      cellCount,
      cellMeasurerCache,
      cellRenderer,
      className,
      height,
      id,
      keyMapper,
      overscanByPixels,
      role,
      style,
      tabIndex,
      width,
      rowDirection,
      isScrolling,
      scrollTop,
    } = this.props;


    const children = [];
    const shortestColumnSize = this._positionCache.shortestColumnSize;
    const measuredCellCount = this._positionCache.count;
    let startIndex = 0;
    let stopIndex;

    this._positionCache.range(
      Math.max(0, scrollTop - overscanByPixels),
      height + overscanByPixels * 2,
      (index: number, left: number, top: number) => {
        if (typeof stopIndex === 'undefined') {
          startIndex = index;
          stopIndex = index;
        }
        else {
          startIndex = Math.min(startIndex, index);
          stopIndex = Math.max(stopIndex, index);
        }

        children.push(
          cellRenderer(
            index, // index
            keyMapper(index), // key
            this, // parent
            {
              height: cellMeasurerCache.getHeight(index),
              [rowDirection === 'ltr' ? 'left' : 'right']: left,
              position: 'absolute',
              top,
              width: this._positionCache.columnWidth
            }, // style
          ),
        );
      },
    );

    // We need to measure additional cells for this layout
    if (
      shortestColumnSize < scrollTop + height + overscanByPixels &&
      measuredCellCount < cellCount
    ) {
      const batchSize = Math.min(
        cellCount - measuredCellCount,
        Math.ceil(
          (
            scrollTop + height + overscanByPixels - shortestColumnSize
          ) /
          cellMeasurerCache.defaultHeight *
          width /
          cellMeasurerCache.defaultWidth,
        ),
      );

      for (let index = measuredCellCount; index < measuredCellCount + batchSize; index++) {
        stopIndex = index;

        children.push(
          cellRenderer(
            index, // index
            keyMapper(index), //key
            this, // parent
            {
              width: this._positionCache.columnWidth,
            } // style
          ),
        );
      }
    }

    this._startIndex = startIndex;
    this._stopIndex = stopIndex;

    return (
      <div
        aria-label={this.props['aria-label']}
        className={clsx('ReactVirtualized__Masonry', className)}
        id={id}
        role={role}
        style={
          typeof style === 'object' && style !== null
            ? {
              ...getDefaultContainerStyle(isScrolling, width),
              ...style,
            }
            : getDefaultContainerStyle(isScrolling)
        }
        tabIndex={tabIndex}
      >
        <div
          className="ReactVirtualized__Masonry__innerScrollContainer"
          style={getInnerStyle(this._getEstimatedTotalHeight())}
        >
          {children}
        </div>
      </div>
    );
  }
}

function identity (value) {
  return value;
}

function noop () {}

type KeyMapper = (index: number) => mixed;

export type CellMeasurerCache = {
  defaultHeight: number,
  defaultWidth: number,
  getHeight: (index: number) => number,
  getWidth: (index: number) => number,
};

type CellRenderer = (
  index: number,
  key: mixed,
  parent: mixed,
  style: mixed,
) => mixed;

type OnCellsRenderedCallback = (
  startIndex: number,
  stopIndex: number,
) => void;

type Position = {
  left: number,
  top: number,
};

export default Masonry;

export type Positioner = (index: number) => Position;
