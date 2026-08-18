import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Issue } from '@/engine'
import { cn } from '@/lib/utils'

const STYLES = {
  error: {
    wrap: 'border-destructive/30 bg-destructive/8 text-destructive',
    icon: AlertCircle,
  },
  warning: {
    wrap: 'border-warning/30 bg-warning/8 text-warning',
    icon: AlertTriangle,
  },
  info: {
    wrap: 'border-border bg-muted/50 text-muted-foreground',
    icon: Info,
  },
} as const

/**
 * A validation issue, rendered with its own severity styling.
 *
 * Errors, warnings and notes look different on purpose — an organizer needs to
 * see at a glance which of these blocks them and which is just information.
 */
export function IssueNote({ issue, className }: { issue: Issue; className?: string }) {
  const style = STYLES[issue.level]
  const Icon = style.icon

  return (
    <div className={cn('flex gap-2.5 rounded-md border p-3 text-sm', style.wrap, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium leading-snug">{issue.message}</p>
        {issue.hint && <p className="text-xs opacity-85">{issue.hint}</p>}
      </div>
    </div>
  )
}

export function IssueList({ issues, className }: { issues: Issue[]; className?: string }) {
  if (issues.length === 0) return null
  // Errors first — they are what the organizer has to act on.
  const order = { error: 0, warning: 1, info: 2 } as const
  const sorted = issues.slice().sort((a, b) => order[a.level] - order[b.level])

  return (
    <div className={cn('space-y-2', className)}>
      {sorted.map((issue, i) => (
        <IssueNote key={`${issue.level}-${i}`} issue={issue} />
      ))}
    </div>
  )
}

/** A compact inline callout for contextual guidance. */
export function Callout({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: 'info' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  className?: string
}) {
  const style = STYLES[variant]
  const Icon = style.icon
  return (
    <div className={cn('flex gap-2.5 rounded-md border p-3 text-sm', style.wrap, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        <div className="text-xs opacity-90">{children}</div>
      </div>
    </div>
  )
}
