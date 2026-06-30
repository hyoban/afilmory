import assert from 'node:assert/strict'

import { it } from 'vitest'

import { isEditableShortcutTarget } from './shortcut-target'

it('isEditableShortcutTarget treats form controls and textbox roles as editable', () => {
  assert.equal(isEditableShortcutTarget({ tagName: 'INPUT' }), true)
  assert.equal(isEditableShortcutTarget({ tagName: 'textarea' }), true)
  assert.equal(isEditableShortcutTarget({ role: 'textbox', tagName: 'DIV' }), true)
  assert.equal(isEditableShortcutTarget({ isContentEditable: true, tagName: 'DIV' }), true)
})

it('isEditableShortcutTarget ignores regular controls', () => {
  assert.equal(isEditableShortcutTarget({ tagName: 'BUTTON' }), false)
  assert.equal(isEditableShortcutTarget(null), false)
})
