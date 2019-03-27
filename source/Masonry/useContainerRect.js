import {useEffect, useState, useRef} from 'react'
import memoizeOne from '../utils/memoizeOne'

const defaultRect = {top: 0, width: 0}
const get = memoizeOne(
  (element, containerRect, windowWidth) => ([
    element,
    containerRect.width || windowWidth,
    containerRect.top
  ])
)

export default (windowWidth, windowHeight) => {
  const element = useRef(null)
  const [containerRect, setContainerRect] = useState(defaultRect)

  useEffect(
    () => {
      if (element.current !== null) {
        // containerRect.current = element.current.getBoundingClientRect()
        setContainerRect({
          top: element.current.offsetTop,
          width: element.current.offsetWidth,
        })
      }
    },
    [windowWidth, windowHeight, element.current]
  )

  return get(element, containerRect, windowWidth)
}
