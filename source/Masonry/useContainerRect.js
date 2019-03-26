import {useEffect, useRef} from 'react'
import memoizeOne from '../utils/memoizeOne'

const get = memoizeOne(
  (element, containerRect, windowWidth) => ([
    element,
    containerRect.width || windowWidth,
    containerRect.top
  ])
)

export default (windowWidth, windowHeight) => {
  const element = useRef(null)
  const containerRect = useRef({top: 0, width: 0})

  useEffect(
    () => {
      if (element.current !== null) {
        //containerRect.current = element.current.getBoundingClientRect()
        containerRect.current = {
          top: element.current.offsetTop,
          width: element.current.offsetWidth,
        }
      }
    },
    [windowWidth, windowHeight, element.current]
  )

  return get(element, containerRect.current, windowWidth)
}
