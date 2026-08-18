import { cn, initials } from '@/lib/utils'
import type { Participant } from '@/types'

/**
 * A participant's logo or colour-coded initials.
 *
 * Works for teams and individuals alike — individuals get a photo where one was
 * uploaded, and a deterministic colour chip otherwise.
 */
export function ParticipantAvatar({
  participant,
  size = 'md',
  className,
}: {
  participant: Pick<Participant, 'name' | 'shortName' | 'logoUrl' | 'color'> | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    xs: 'size-4 text-[8px]',
    sm: 'size-6 text-[10px]',
    md: 'size-8 text-xs',
    lg: 'size-11 text-sm',
    xl: 'size-16 text-lg',
  } as const

  if (!participant) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground',
          sizes[size],
          className,
        )}
        aria-hidden
      >
        ?
      </div>
    )
  }

  if (participant.logoUrl) {
    return (
      <img
        src={participant.logoUrl}
        alt=""
        className={cn('shrink-0 rounded-md object-cover', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md font-bold text-white',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: participant.color }}
      aria-hidden
    >
      {initials(participant.name)}
    </div>
  )
}

/**
 * Avatar + name, the standard way a participant appears in a list, table or
 * match card. Falls back to a placeholder when the slot is not yet decided.
 */
export function ParticipantChip({
  participant,
  placeholder = 'TBD',
  size = 'md',
  seed,
  showSeed = false,
  bold = false,
  muted = false,
  className,
  nameClassName,
  useShortName = false,
}: {
  participant: Participant | null | undefined
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  seed?: number | null
  showSeed?: boolean
  bold?: boolean
  muted?: boolean
  className?: string
  nameClassName?: string
  useShortName?: boolean
}) {
  const textSize = { xs: 'text-xs', sm: 'text-xs', md: 'text-sm', lg: 'text-base' } as const
  const displaySeed = seed ?? participant?.seed ?? null

  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <ParticipantAvatar participant={participant ?? null} size={size} />
      <span
        className={cn(
          'min-w-0 truncate',
          textSize[size],
          bold && 'font-semibold',
          (muted || !participant) && 'text-muted-foreground',
          nameClassName,
        )}
      >
        {participant ? (useShortName ? participant.shortName : participant.name) : placeholder}
      </span>
      {showSeed && displaySeed != null && (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground tnum">
          {displaySeed}
        </span>
      )}
    </span>
  )
}
