// The app's icons: Lucide (rounded line icons) plus a few music ones Lucide lacks, drawn in the same style.
import { Hand, Piano, type LucideProps } from 'lucide-react'

export {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Download, Ear, FileMusic, FolderOpen, Footprints,
  KeyboardMusic, KeyRound, Lock, Metronome, Mic, Music, PartyPopper, Piano, Play, RefreshCw, Repeat, RotateCcw, Search, Settings,
  SkipBack, Sparkles, Square, Target, Timer, Trash2, TriangleAlert, Upload, Volume2,
} from 'lucide-react'

function LineIcon({ size = 24, strokeWidth = 2, className = '', children, ...rest }: LucideProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`lucide ${className}`} aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

/** Transverse flute: a tube with its keys. */
export function Flute(props: LucideProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.5 18.5 18.5 3.5a2.1 2.1 0 0 1 3 3l-15 15a2.1 2.1 0 0 1-3-3Z" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      <circle cx="12.5" cy="11.5" r="0.6" fill="currentColor" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" />
      <circle cx="7.5" cy="16.5" r="0.6" fill="currentColor" />
    </LineIcon>
  )
}

/** A scale: three notes going up step by step. */
export function Scale(props: LucideProps) {
  return (
    <LineIcon {...props}>
      <ellipse cx="4.5" cy="20" rx="2.5" ry="2" fill="currentColor" />
      <ellipse cx="11.5" cy="15.5" rx="2.5" ry="2" fill="currentColor" />
      <ellipse cx="18.5" cy="11" rx="2.5" ry="2" fill="currentColor" />
      <path d="M7 20V12M14 15.5V7.5M21 11V3" />
    </LineIcon>
  )
}

const INSTRUMENT_ICONS: Record<string, (props: LucideProps) => React.ReactNode> = { piano: Piano, flute: Flute }

/** The icon of an instrument by its id (piano, flute…). */
export function InstrumentIcon({ id, ...props }: LucideProps & { id: string }) {
  const Icon = INSTRUMENT_ICONS[id] ?? Piano
  return <Icon {...props} />
}

/** Difficulty level as filled stars. */
export function Stars({ count, label = true }: { count: number; label?: boolean }) {
  return (
    <span className="stars-inline" aria-label={label ? `Nivel ${count}` : undefined}>
      {Array.from({ length: count }, (_, i) => <StarFilled key={i} />)}
    </span>
  )
}

export function StarFilled(props: LucideProps) {
  return (
    <LineIcon {...props} fill="currentColor">
      <path d="M11.5 2.9a.6.6 0 0 1 1 0l2.6 5.3 5.8.8a.6.6 0 0 1 .3 1l-4.2 4.1 1 5.8a.6.6 0 0 1-.8.6L12 17.8l-5.2 2.7a.6.6 0 0 1-.8-.6l1-5.8-4.2-4.1a.6.6 0 0 1 .3-1l5.8-.8Z" />
    </LineIcon>
  )
}

/** What each staff is played with: right or left hand on the piano, the flute for flute parts. */
export function StaffIcon({ instrument, staff }: { instrument: string; staff: number }) {
  if (instrument === 'flute') return <Flute />
  return <Hand className={staff === 1 ? 'mirrored' : ''} />
}
