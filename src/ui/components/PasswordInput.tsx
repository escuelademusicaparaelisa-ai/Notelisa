import { useState } from 'react'
import { Eye, EyeOff } from '../icons'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { initiallyVisible?: boolean }

/** A password box with an eye button to show or hide what has been typed. */
export function PasswordInput({ initiallyVisible = false, ...input }: Props) {
  const [visible, setVisible] = useState(initiallyVisible)
  return (
    <span className="password-input">
      <input {...input} type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} />
      <button type="button" className="password-eye" onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </span>
  )
}
