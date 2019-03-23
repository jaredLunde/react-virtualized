// @flow

import * as React from 'react';

export type RowRendererParams = (
  index: number,
  key: string,
  parent: Object,
  style: Object,
  isVisible: boolean,
) => void;

export type RowRenderer = (params: RowRendererParams) => React.Element<*>;

export type RenderedRows = (
  startIndex: number,
  stopIndex: number,
  overscanStartIndex: number,
  overscanStopIndex: number,
) => void;
