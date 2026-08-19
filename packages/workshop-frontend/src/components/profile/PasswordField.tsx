import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { FieldLabel, INPUT } from './controls'

/**
 * On-language password field: same input/focus treatment as the rest of the app, with an inline
 * show/hide toggle (replacing Kumo's SensitiveInput, which read as dated against the new look).
 */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  description?: string
  error?: string | null
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${INPUT} pr-10 ${error ? 'border-destructive focus:border-destructive' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-destructive">{error}</p>
      ) : description ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
