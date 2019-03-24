import {useState, useEffect, useCallback, useRef} from 'react'
import emptyArr from 'empty/array'
import emptyObj from 'empty/object'
import {requestTimeout, clearRequestTimeout} from '@render-props/utils'
import useViewportScroll from './useViewportScroll'
import useViewportSize from './useViewportSize'


const defaultSizeOpt = {wait: 120, immediate: false}
const defaultScrollOpt = {fps: 16}

export default (opt = emptyObj) => {
  const scrollY = useViewportScroll(0, opt.scroll || defaultScrollOpt)
  const [width, height] = useViewportSize(
    opt?.size?.initialWidth || 360,
    opt?.size?.initialHeight || 720,
    opt.size || defaultSizeOpt
  )
  const [state, setState] = useState({isScrolling: false})
  const element = useRef(null)
  const offsetTop = useRef(0)
  const isScrollingTimeout = useRef(null)
  const unsetIsScrolling  = useCallback(
    () => {
      setState({isScrolling: false})
      isScrollingTimeout.current = null
    },
    emptyArr
  )

  useEffect(
    () => {
      if (element.current !== null) {
        offsetTop.current = element.current.offsetTop
      }
    },
    [element.current, width, height]
  )


  useEffect(
    () => {
      if (state.isScrolling === false) {
        setState({isScrolling: true})
      }

      if (isScrollingTimeout.current !== null) {
        clearRequestTimeout(isScrollingTimeout.current)
      }

      isScrollingTimeout.current = requestTimeout(unsetIsScrolling, 240)
      return () =>
        isScrollingTimeout.current !== null && clearRequestTimeout(isScrollingTimeout.current)
    },
    [scrollY]
  )

  return [
    element,
    {
      width,
      height,
      scrollY,
      scrollTop: Math.max(0, scrollY - offsetTop.current),
      isScrolling: state.isScrolling
    }
  ]
}
