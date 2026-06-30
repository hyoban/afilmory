import assert from 'node:assert/strict'

import { it } from 'vitest'

import { shouldHandlePromptConfirmShortcut } from './prompt-keyboard'

it('shouldHandlePromptConfirmShortcut accepts an unmodified Enter key', () => {
  assert.equal(
    shouldHandlePromptConfirmShortcut({
      isSubmitting: false,
      key: 'Enter',
      target: { tagName: 'BUTTON' },
    }),
    true,
  )
})

it('shouldHandlePromptConfirmShortcut ignores editable targets and inactive states', () => {
  const base = {
    isSubmitting: false,
    key: 'Enter',
    target: { tagName: 'BUTTON' },
  }

  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, key: 'Escape' }), false)
  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, metaKey: true }), false)
  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, isSubmitting: true }), false)
  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, target: { tagName: 'INPUT' } }), false)
  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, target: { tagName: 'TEXTAREA' } }), false)
  assert.equal(
    shouldHandlePromptConfirmShortcut({ ...base, target: { isContentEditable: true, tagName: 'DIV' } }),
    false,
  )
  assert.equal(shouldHandlePromptConfirmShortcut({ ...base, target: { role: 'textbox', tagName: 'DIV' } }), false)
})
