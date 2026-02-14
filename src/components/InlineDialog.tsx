import { useState, useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger }: ConfirmDialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onConfirm, onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="rounded border border-[var(--c-border)] bg-[var(--c-bg-3)] shadow-xl px-5 py-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-[var(--c-text-1)] mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1 rounded text-[var(--c-text-3)] hover:text-[var(--c-text-1)] cursor-pointer">Cancel</button>
          <button
            onClick={onConfirm}
            className={`text-sm px-3 py-1 rounded text-white cursor-pointer ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PromptDialogProps {
  message: string
  placeholder?: string
  onSubmit: (value: string) => void
  onCancel: () => void
  submitLabel?: string
}

export function PromptDialog({ message, placeholder, onSubmit, onCancel, submitLabel = 'Save' }: PromptDialogProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="rounded border border-[var(--c-border)] bg-[var(--c-bg-3)] shadow-xl px-5 py-4 max-w-sm w-80" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-[var(--c-text-1)] mb-3">{message}</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(value.trim()) }}
          placeholder={placeholder}
          className="w-full rounded border border-[var(--c-border-s)] bg-[var(--c-bg-hover)] px-2 py-1 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-4)] outline-none focus:border-blue-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1 rounded text-[var(--c-text-3)] hover:text-[var(--c-text-1)] cursor-pointer">Cancel</button>
          <button
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={!value.trim()}
            className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 cursor-pointer"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
