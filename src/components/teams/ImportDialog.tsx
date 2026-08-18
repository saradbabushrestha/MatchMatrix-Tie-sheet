import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from '@/components/ui/table'
import { IssueNote } from '@/components/shared/IssueNote'
import { downloadTemplate, parseImportFile, type ImportPreview } from '@/services/importService'
import { useTeamStore } from '@/stores/useTeamStore'
import type { SportConfig } from '@/types'
import { cn } from '@/lib/utils'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sport: SportConfig
  existingTeamNames: string[]
  /** 'wizard' hands names back; 'tournament' writes teams and players directly. */
  mode: 'wizard' | 'tournament'
  tournamentId?: string
  onWizardImport?: (names: string[]) => void
  onImported?: () => void
}

/**
 * Bulk import with a mandatory preview.
 *
 * Nothing is written until the organizer has seen the row count, the teams that
 * will be created and every warning the parser raised.
 */
export function ImportDialog({
  open,
  onOpenChange,
  sport,
  existingTeamNames,
  mode,
  tournamentId,
  onWizardImport,
  onImported,
}: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [dragging, setDragging] = useState(false)

  const addTeams = useTeamStore((s) => s.addTeams)
  const addPlayers = useTeamStore((s) => s.addPlayers)
  const teams = useTeamStore((s) => s.teams)

  const isTeamSport = sport.participantType === 'team'

  async function handleFile(file: File | undefined) {
    if (!file) return
    setParsing(true)
    setFileName(file.name)
    try {
      setPreview(await parseImportFile(file, sport, existingTeamNames))
    } catch (error) {
      toast.error('Could not read that file', {
        description: error instanceof Error ? error.message : undefined,
      })
      setPreview(null)
    } finally {
      setParsing(false)
    }
  }

  function reset() {
    setPreview(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleConfirm() {
    if (!preview?.ok) return

    if (mode === 'wizard') {
      const names = isTeamSport
        ? preview.teams.map((t) => t.name)
        : preview.individuals.map((p) => p.name)
      onWizardImport?.(names)
      toast.success(`Imported ${names.length} ${names.length === 1 ? 'entry' : 'entries'}`, {
        description: isTeamSport
          ? 'Squad details from the file will be available once the tournament is created.'
          : undefined,
      })
      reset()
      onOpenChange(false)
      return
    }

    if (!tournamentId) return

    if (isTeamSport) {
      // Reuse a team that already exists rather than creating a duplicate.
      const existing = new Map(
        teams
          .filter((t) => t.tournamentId === tournamentId)
          .map((t) => [t.name.toLowerCase(), t.id]),
      )

      const toCreate = preview.teams.filter((t) => !existing.has(t.name.toLowerCase()))
      const created = addTeams(
        toCreate.map((t) => ({
          tournamentId,
          name: t.name,
          shortName: t.shortName,
          seed: t.seed,
        })),
      )
      created.forEach((team) => existing.set(team.name.toLowerCase(), team.id))

      const players = preview.rows
        .filter((row) => row.playerName)
        .map((row) => ({
          tournamentId,
          teamId: existing.get(row.teamName.toLowerCase()) ?? null,
          name: row.playerName,
          jerseyNumber: row.jerseyNumber,
          position: row.position,
          isCaptain: row.isCaptain,
          phone: row.phone,
          email: row.email,
        }))

      if (players.length > 0) addPlayers(players)

      toast.success('Import complete', {
        description: `${created.length} new team${created.length === 1 ? '' : 's'} and ${players.length} player${players.length === 1 ? '' : 's'} added.`,
      })
    } else {
      const players = preview.individuals.map((p) => ({
        tournamentId,
        teamId: null,
        name: p.name,
        seed: p.seed,
      }))
      addPlayers(players)
      toast.success('Import complete', {
        description: `${players.length} player${players.length === 1 ? '' : 's'} added.`,
      })
    }

    reset()
    onImported?.()
    onOpenChange(false)
  }

  const errors = preview?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = preview?.issues.filter((i) => i.level === 'warning') ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent size="xl" className="max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>Import {isTeamSport ? 'teams & players' : 'players'}</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Everything is checked before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                void handleFile(e.dataTransfer.files?.[0])
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {parsing ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                <FileSpreadsheet className="size-6 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="font-medium">
                  {parsing ? 'Reading the file…' : 'Drop a CSV or Excel file here'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or choose one from your computer
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={parsing}>
                <Upload />
                Choose file
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Not sure about the format?</p>
                  <p className="text-xs text-muted-foreground">
                    Download a sample file already set up for {sport.name}, fill it in, and upload it back.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(sport)}>
                  <Download />
                  Sample template
                </Button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <code className="block whitespace-pre text-xs text-muted-foreground">
                  {isTeamSport
                    ? 'team_name,player_name,jersey_number,position\nTeam A,Ram,1,GK\nTeam A,Shyam,2,DF\nTeam B,Hari,1,GK'
                    : 'player_name,seed\nSarad Shrestha,1\nAnita Rai,2\nBimal Karki,3'}
                </code>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Column names are flexible — "team", "club", "name", "no" and similar are all understood.
              </p>
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{fileName}</Badge>
              <Badge variant="muted">{preview.rows.length} rows</Badge>
              {isTeamSport ? (
                <Badge variant={preview.ok ? 'success' : 'muted'}>
                  {preview.teams.length} teams
                </Badge>
              ) : (
                <Badge variant={preview.ok ? 'success' : 'muted'}>
                  {preview.individuals.length} players
                </Badge>
              )}
              {errors.length > 0 && <Badge variant="destructive">{errors.length} errors</Badge>}
              {warnings.length > 0 && <Badge variant="warning">{warnings.length} warnings</Badge>}
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                Choose a different file
              </Button>
            </div>

            {(errors.length > 0 || warnings.length > 0) && (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {[...errors, ...warnings].slice(0, 12).map((issue, i) => (
                  <IssueNote
                    key={i}
                    issue={{
                      level: issue.level,
                      message: issue.line ? `Row ${issue.line}: ${issue.message}` : issue.message,
                    }}
                  />
                ))}
                {errors.length + warnings.length > 12 && (
                  <p className="text-xs text-muted-foreground">
                    …and {errors.length + warnings.length - 12} more.
                  </p>
                )}
              </div>
            )}

            {preview.rows.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="max-h-64 overflow-y-auto">
                  <TableScroller>
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          {isTeamSport && <TableHead>Team</TableHead>}
                          <TableHead>Player</TableHead>
                          {isTeamSport && <TableHead className="w-16">No.</TableHead>}
                          <TableHead className="w-24">Position</TableHead>
                          {!isTeamSport && <TableHead className="w-16">Seed</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.slice(0, 100).map((row) => (
                          <TableRow key={row.line}>
                            <TableCell className="text-xs text-muted-foreground tnum">
                              {row.line}
                            </TableCell>
                            {isTeamSport && (
                              <TableCell className="font-medium">{row.teamName}</TableCell>
                            )}
                            <TableCell>
                              {row.playerName || <span className="text-muted-foreground">—</span>}
                              {row.isCaptain && (
                                <Badge variant="default" className="ml-1.5">
                                  C
                                </Badge>
                              )}
                            </TableCell>
                            {isTeamSport && (
                              <TableCell className="tnum">{row.jerseyNumber ?? '—'}</TableCell>
                            )}
                            <TableCell className="text-muted-foreground">
                              {row.position ?? '—'}
                            </TableCell>
                            {!isTeamSport && (
                              <TableCell className="tnum">{row.seed ?? '—'}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableScroller>
                </div>
                {preview.rows.length > 100 && (
                  <p className="border-t border-border p-2 text-center text-xs text-muted-foreground">
                    Showing the first 100 of {preview.rows.length} rows — all of them will be imported.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!preview?.ok}>
            {preview?.ok
              ? `Import ${isTeamSport ? `${preview.teams.length} teams` : `${preview.individuals.length} players`}`
              : 'Import'}
          </Button>
        </DialogFooter>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </DialogContent>
    </Dialog>
  )
}
