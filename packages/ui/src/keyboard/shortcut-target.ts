export type ShortcutTarget = {
  isContentEditable?: boolean
  role?: string | null
  tagName?: string | null
}

const editableShortcutTargetTags = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

export const getShortcutTarget = (target: EventTarget | null): ShortcutTarget | null => {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return null
  }

  return {
    isContentEditable: target.isContentEditable,
    role: target.getAttribute('role'),
    tagName: target.tagName,
  }
}

export const isEditableShortcutTarget = (target: ShortcutTarget | null | undefined): boolean => {
  if (!target) {
    return false
  }

  const tagName = target.tagName?.toUpperCase()
  if (tagName && editableShortcutTargetTags.has(tagName)) {
    return true
  }

  return Boolean(target.isContentEditable || target.role === 'textbox')
}
