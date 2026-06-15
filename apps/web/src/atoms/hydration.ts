import { atom } from 'jotai'

import { jotaiStore } from '~/lib/jotai'

// Flips after the initial load settles so components can skip their entry
// animation on a direct page load (LCP) while still animating on later
// in-app navigations. Snapshot it in a useState initializer at mount.
export const hydrationEndAtom = atom(false)

export const isHydrationEnded = () => jotaiStore.get(hydrationEndAtom)
