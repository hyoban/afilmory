import { useState } from 'react'

import { Button } from '../button/Button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { Modal } from '../modal'
import type { ModalComponent, ModalComponentProps } from '../modal/types'
import { getPromptConfirmShortcutTarget, shouldHandlePromptConfirmShortcut } from './prompt-keyboard'

type PromptVariant = 'danger' | 'info'

export type PromptOptions = {
  title: string
  description?: string
  variant?: PromptVariant
  onConfirmText?: string
  onCancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  content?: React.ReactNode
}

export const BasePrompt: ModalComponent<PromptOptions> = ({
  modalId,
  dismiss,
  title,
  description,
  variant = 'info',
  onConfirmText = 'Confirm',
  onCancelText = 'Cancel',
  onConfirm,
  onCancel,
  content,
}: ModalComponentProps & PromptOptions) => {
  const [submitting, setSubmitting] = useState(false)

  const handleCancel = async () => {
    try {
      await onCancel?.()
    }
    finally {
      dismiss()
    }
  }

  const handleConfirm = async () => {
    if (submitting) {
      return
    }

    try {
      setSubmitting(true)
      await onConfirm?.()
    }
    finally {
      setSubmitting(false)
      Modal.dismiss(modalId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !shouldHandlePromptConfirmShortcut({
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        isSubmitting: submitting,
        key: event.key,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target: getPromptConfirmShortcutTarget(event.target),
      })
    ) {
      return
    }

    event.preventDefault()
    void handleConfirm()
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <DialogHeader className="mb-2">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription className="text-text-secondary">{description}</DialogDescription> : null}
      </DialogHeader>
      {content && <div className="mt-4">{content}</div>}
      <DialogFooter className="mt-4">
        <Button size="sm" variant="secondary" onClick={handleCancel} disabled={submitting}>
          {onCancelText}
        </Button>
        <Button
          autoFocus
          size="sm"
          variant={variant === 'danger' ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          isLoading={submitting}
          loadingText={onConfirmText}
        >
          {onConfirmText}
        </Button>
      </DialogFooter>
    </div>
  )
}

BasePrompt.contentClassName = 'max-w-sm'

export type { PromptVariant }
