import type { ShortcutTarget } from '../keyboard'
import { getShortcutTarget, isEditableShortcutTarget } from '../keyboard'

type PromptConfirmShortcutInput = {
  altKey?: boolean
  ctrlKey?: boolean
  isSubmitting: boolean
  key: string
  metaKey?: boolean
  shiftKey?: boolean
  target?: ShortcutTarget | null
}

export const getPromptConfirmShortcutTarget = getShortcutTarget

export const shouldHandlePromptConfirmShortcut = ({
  altKey = false,
  ctrlKey = false,
  isSubmitting,
  key,
  metaKey = false,
  shiftKey = false,
  target,
}: PromptConfirmShortcutInput) => {
  if (isSubmitting || key !== 'Enter') {
    return false
  }

  if (altKey || ctrlKey || metaKey || shiftKey) {
    return false
  }

  if (!target) {
    return true
  }

  return !isEditableShortcutTarget(target)
}
