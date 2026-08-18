import { useState } from 'react'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  Loader2,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Checkbox, Switch } from '@/components/ui/controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/StatCard'
import { IssueList } from '@/components/shared/IssueNote'
import { useTournamentPage, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useStandings } from '@/hooks/useTournamentData'
import { useTournamentStore } from '@/stores/useTournamentStore'
import {
  exportCSV,
  exportExcel,
  exportPDF,
  TARGET_LABELS,
  type ExportTarget,
  type Orientation,
  type PaperSize,
} from '@/services/exportService'
import { validatePublish } from '@/engine/validation'
import { getFormat } from '@/config/formats'
import { slugify } from '@/lib/utils'

const ALL_TARGETS: ExportTarget[] = [
  'tiesheet',
  'fixtures',
  'results',
  'standings',
  'teams',
  'players',
  'schedule',
]

/** Sharing and exporting. */
export function SharePage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <ShareView tournament={page.tournament} data={page.data} />
}

function ShareView({ tournament, data }: TournamentViewProps) {
  const standings = useStandings(data)
  const updateTournament = useTournamentStore((s) => s.updateTournament)

  const [selected, setSelected] = useState<Set<ExportTarget>>(
    new Set<ExportTarget>(['tiesheet', 'fixtures', 'standings']),
  )
  const [paper, setPaper] = useState<PaperSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [slugDraft, setSlugDraft] = useState(tournament.slug)

  const format = getFormat(tournament.formatType)
  const validation = validatePublish(data.matches, data.participants)

  // The public page lives on a hash route, so the link works from a static host.
  const publicUrl = `${window.location.origin}${window.location.pathname}#/p/${tournament.slug}`

  const ctx = { ...data, standings }

  const available = ALL_TARGETS.filter((target) => {
    if (target === 'tiesheet') return format.hasBracket
    if (target === 'standings') return standings.length > 0
    if (target === 'players') return data.players.length > 0
    if (target === 'teams') return data.teams.length > 0
    if (target === 'schedule') return data.matches.some((m) => m.date)
    if (target === 'results')
      return data.matches.some((m) => m.status === 'completed' || m.status === 'walkover')
    return data.matches.length > 0
  })

  function toggle(target: ExportTarget) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(target)) next.delete(target)
      else next.add(target)
      return next
    })
  }

  function handlePDF() {
    const targets = available.filter((t) => selected.has(t))
    if (targets.length === 0) {
      toast.error('Choose at least one section to include')
      return
    }
    setBusy('pdf')
    window.setTimeout(() => {
      try {
        exportPDF(ctx, { paper, orientation, targets })
        toast.success('PDF saved', {
          description: `${targets.length} section${targets.length === 1 ? '' : 's'} · ${paper.toUpperCase()} ${orientation}`,
        })
      } catch (error) {
        toast.error('Could not create the PDF', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setBusy(null)
      }
    }, 20)
  }

  async function handleExcel() {
    const targets = available.filter((t) => selected.has(t))
    if (targets.length === 0) {
      toast.error('Choose at least one section to include')
      return
    }
    setBusy('excel')
    try {
      await exportExcel(ctx, targets)
      toast.success('Excel workbook saved', { description: 'One sheet per section.' })
    } catch (error) {
      toast.error('Could not create the workbook', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  function handleCSV(target: ExportTarget) {
    try {
      exportCSV(ctx, target)
      toast.success(`${TARGET_LABELS[target]} exported`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link', { description: 'Select it and copy manually.' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Share & Export"
        description="Publish a public page, or download the tie sheet, fixtures and standings."
      />

      {/* Public page */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-4" />
                Public tournament page
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                A read-only page anyone can open — fixtures, results, standings and squads, with no
                sign-in.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="public-toggle" className="text-sm">
                {tournament.publicVisible ? 'Live' : 'Off'}
              </Label>
              <Switch
                id="public-toggle"
                checked={tournament.publicVisible}
                onCheckedChange={(publicVisible) => {
                  updateTournament(tournament.id, { publicVisible })
                  toast.success(publicVisible ? 'Public page is live' : 'Public page turned off')
                }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {tournament.publicVisible ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={publicUrl} readOnly className="font-mono text-xs" aria-label="Public link" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyLink}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`#/p/${tournament.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      Open
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field
                  label="Link name"
                  htmlFor="slug"
                  hint="Letters, numbers and dashes. Changing this breaks any link you have already shared."
                  className="flex-1"
                >
                  <Input
                    id="slug"
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                    className="font-mono text-sm"
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={slugDraft === tournament.slug || !slugDraft.trim()}
                  onClick={() => {
                    const clean = slugify(slugDraft, false)
                    const clash = useTournamentStore
                      .getState()
                      .tournaments.some((t) => t.id !== tournament.id && t.slug === clean)
                    if (clash) {
                      toast.error('That link name is already used by another tournament')
                      return
                    }
                    updateTournament(tournament.id, { slug: clean })
                    setSlugDraft(clean)
                    toast.success('Link updated')
                  }}
                >
                  Update link
                </Button>
              </div>

              {validation.issues.length > 0 && <IssueList issues={validation.issues} />}
            </>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Turn this on to get a shareable link. Nothing is uploaded — the page is served from this
              browser's copy of the tournament, so it works when you host the app anywhere.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Export</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose what to include, then pick a format.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Sections</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {available.map((target) => (
                <label
                  key={target}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2.5 transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={selected.has(target)}
                    onCheckedChange={() => toggle(target)}
                    aria-label={TARGET_LABELS[target]}
                  />
                  <span className="text-sm">{TARGET_LABELS[target]}</span>
                </label>
              ))}
            </div>
            {available.length < ALL_TARGETS.length && (
              <p className="text-xs text-muted-foreground">
                Sections with no data yet are hidden.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
            <Field label="Paper size" hint="A3 suits large brackets">
              <Select value={paper} onValueChange={(v) => setPaper(v as PaperSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="a3">A3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Orientation">
              <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePDF} disabled={busy !== null}>
              {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleExcel} disabled={busy !== null}>
              {busy === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            {format.hasBracket && (
              <Button variant="outline" asChild>
                <a href={`#/t/${tournament.id}/bracket`}>
                  <FileImage />
                  Bracket as PNG
                </a>
              </Button>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Individual CSV files</Label>
            <div className="flex flex-wrap gap-2">
              {available.map((target) => (
                <Button
                  key={target}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCSV(target)}
                >
                  <Download />
                  {TARGET_LABELS[target]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary of what will be shared */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>What is in this tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {data.participants.length}{' '}
              {tournament.participantType === 'team' ? 'teams' : 'players'}
            </Badge>
            {data.teams.length > 0 && data.players.length > 0 && (
              <Badge variant="muted">{data.players.length} squad members</Badge>
            )}
            <Badge variant="muted">{data.matches.filter((m) => !m.isBye).length} matches</Badge>
            <Badge variant="muted">
              {
                data.matches.filter((m) => m.status === 'completed' || m.status === 'walkover')
                  .length
              }{' '}
              played
            </Badge>
            {data.venues.length > 0 && <Badge variant="muted">{data.venues.length} venues</Badge>}
            {data.officials.length > 0 && (
              <Badge variant="muted">{data.officials.length} officials</Badge>
            )}
            <Badge variant={tournament.publicVisible ? 'success' : 'muted'}>
              {tournament.publicVisible ? (
                <>
                  <Eye className="size-3" />
                  Public
                </>
              ) : (
                <>
                  <EyeOff className="size-3" />
                  Private
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
