import type { ExtractAtomValue, getDefaultStore } from 'jotai'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { useCallback } from 'react'

import { viewportAtom } from '../atoms/viewport'

const shallowEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) {
    return true
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false
  }
  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)
  if (keysA.length !== keysB.length) {
    return false
  }
  for (const key of keysA) {
    if (
      !Object.hasOwn(b as object, key)
      || !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false
    }
  }
  return true
}

export const useViewport = <T>(selector: (value: ExtractAtomValue<typeof viewportAtom>) => T): T =>
  useAtomValue(
    selectAtom(
      viewportAtom,
      useCallback(atomValue => selector(atomValue), []),
      shallowEqual,
    ),
  )

type JotaiStore = ReturnType<typeof getDefaultStore>
export const getViewport = (store: JotaiStore) => store.get(viewportAtom)
