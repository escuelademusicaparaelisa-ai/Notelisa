import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from '../icons'

/**
 * The bar's buttons gathered in one "Menú" button that opens a list, so they do not fill the screen on phones.
 * The list stays in the page while closed, so a file picker opened from it still gets its file.
 */
export function NavMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="nav-menu" ref={box}>
      <button className="chip nav-menu-button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        Menú <ChevronDown />
      </button>
      {/* Choosing anything in the list closes it. */}
      <div className="nav-menu-list" hidden={!open} onClick={() => setOpen(false)}>
        {children}
      </div>
    </div>
  )
}
