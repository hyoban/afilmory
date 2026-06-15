import { useEffect } from 'react'

import { hydrationEndAtom } from '~/atoms/hydration'
import { jotaiStore } from '~/lib/jotai'

export const HydrationEndDetector = () => {
  useEffect(() => {
    const timeout = setTimeout(() => {
      jotaiStore.set(hydrationEndAtom, true)
    }, 2000)

    return () => clearTimeout(timeout)
  }, [])
  return null
}
