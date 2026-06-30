type PromptConfirmShortcutTarget = {
  isContentEditable?: boolean
  role?: string | null
  tagName?: string | null
}

type PromptConfirmShortcutInput = {
  altKey?: boolean
  ctrlKey?: boolean
  isSubmitting: boolean
  key: string
  metaKey?: boolean
  shiftKey?: boolean
  target?: PromptConfirmShortcutTarget | null
}

const editablePromptTargetTags = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

export const getPromptConfirmShortcutTarget = (target: EventTarget | null): PromptConfirmShortcutTarget | null => {
  if (!(target instanceof HTMLElement)) {
    return null
  }

  return {
    isContentEditable: target.isContentEditable,
    role: target.getAttribute('role'),
    tagName: target.tagName,
  }
}

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

  const tagName = target.tagName?.toUpperCase()
  if (tagName && editablePromptTargetTags.has(tagName)) {
    return false
  }

  return !target.isContentEditable && target.role !== 'textbox'
}
