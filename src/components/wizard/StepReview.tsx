import { CalendarDays, Check, MapPin, Trophy, User, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DetailRow, SectionTitle } from '@/components/shared/StatCard'
import { IssueList } from '@/components/shared/IssueNote'
import { useWizardStore } from '@/stores/useWizardStore'
import { useSport } from '@/stores/useSportStore'
import { getFormat } from '@/config/formats'
import { estimateMatchCount } from '@/engine'
import { entrantLabel, entrantWord, validateFixtureGeneration } from '@/engine/validation'
import { formatDateLong } from '@/lib/date'
import { colorFor, guessShortName, initials, nextPowerOfTwo } from '@/lib/utils'
import { pointsSummary } from '@/services/tournamentService'

/** Step 4 — confirm what is about to be created. */
export function StepReview() {
  const { info, formatType, config, entrants } = useWizardStore()
  const sport = useSport(info.sportId)
  const format = getFormat(formatType)

  const matchCount = estimateMatchCount(formatType, entrants.length, config)
  const label = entrantLabel(sport)

  const validation = validateFixtureGeneration(
    formatType,
    entrants.map((e, i) => ({
      id: e.key,
      name: e.name,
      shortName: e.shortName || guessShortName(e.name),
      logoUrl: null,
      color: colorFor(e.name),
      seed: e.seed ?? i + 1,
      groupId: null,
      kind: sport.participantType === 'team' ? ('team' as const) : ('player' as const),
    })),
    config,
    sport,
  )

  const canGenerate = entrants.length >= format.minParticipants && validation.ok

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review & create</h2>
        <p className="text-sm text-muted-foreground">
          {canGenerate
            ? 'Everything checks out. Creating the tournament will also generate the fixtures.'
            : `You can create the tournament now and add ${entrantWord(sport, 2)} later — fixtures will be generated once you have enough.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle className="mb-3">Tournament</SectionTitle>
          <div className="mb-4 flex items-center gap-3">
            {info.logoUrl ? (
              <img src={info.logoUrl} alt="" className="size-12 rounded-lg object-cover" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/12 text-2xl">
                {sport.icon}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{info.name || 'Untitled tournament'}</p>
              <p className="text-sm text-muted-foreground">
                {sport.name} · {format.name}
              </p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {info.description && (
              <p className="pb-2 text-sm text-muted-foreground">{info.description}</p>
            )}
            <DetailRow
              label="Organized by"
              value={info.organizer || <span className="text-muted-foreground">Not set</span>}
            />
            <DetailRow
              label="Venue"
              value={
                info.venue ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {info.venue}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )
              }
            />
            <DetailRow
              label="Dates"
              value={
                info.startDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    {formatDateLong(info.startDate)}
                    {info.endDate && info.endDate !== info.startDate
                      ? ` – ${formatDateLong(info.endDate)}`
                      : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )
              }
            />
            {(info.contactName || info.contactPhone || info.contactEmail) && (
              <DetailRow
                label="Contact"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {[info.contactName, info.contactPhone, info.contactEmail]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                }
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle className="mb-3">Structure</SectionTitle>
          <div className="divide-y divide-border">
            <DetailRow label="Format" value={format.name} />
            <DetailRow
              label={label}
              value={
                <span className="tnum">
                  {entrants.length} {entrantWord(sport, entrants.length)}
                </span>
              }
            />
            <DetailRow label="Matches" value={<span className="tnum">{matchCount}</span>} />

            {format.hasBracket && entrants.length >= 2 && (
              <DetailRow
                label="Bracket size"
                value={
                  <span className="tnum">
                    {nextPowerOfTwo(entrants.length)} slots
                    {nextPowerOfTwo(entrants.length) > entrants.length &&
                      ` · ${nextPowerOfTwo(entrants.length) - entrants.length} byes`}
                  </span>
                }
              />
            )}

            {formatType === 'group_knockout' && (
              <>
                <DetailRow label="Groups" value={<span className="tnum">{config.groupCount}</span>} />
                <DetailRow
                  label="Advance per group"
                  value={<span className="tnum">{config.advancePerGroup}</span>}
                />
                <DetailRow
                  label="Qualifiers"
                  value={
                    <span className="tnum">{config.groupCount * config.advancePerGroup}</span>
                  }
                />
              </>
            )}

            {formatType === 'round_robin' && (
              <DetailRow
                label="Rounds"
                value={config.doubleRoundRobin ? 'Home and away' : 'Single round'}
              />
            )}

            {sport.scoringType === 'sets' && (
              <DetailRow
                label="Match format"
                value={
                  config.bestOf > 1
                    ? `Best of ${config.bestOf}`
                    : `Single ${sport.periods.label.toLowerCase()}`
                }
              />
            )}

            {format.hasStandings && (
              <DetailRow label="Points" value={pointsSummary(sport, config)} />
            )}

            {format.hasBracket && (
              <DetailRow
                label="Draw"
                value={
                  config.drawMethod === 'seeded'
                    ? 'Seeded'
                    : config.drawMethod === 'random'
                      ? 'Random'
                      : 'Manual'
                }
              />
            )}

            {config.thirdPlaceMatch && format.hasBracket && (
              <DetailRow label="Third place" value="Play-off included" />
            )}
          </div>
        </Card>
      </div>

      {entrants.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>
            {label} ({entrants.length})
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {entrants.map((entrant, i) => (
              <span
                key={entrant.key}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card py-1 pl-1 pr-2 text-sm"
              >
                <span
                  className="flex size-5 items-center justify-center rounded text-[9px] font-bold text-white"
                  style={{ backgroundColor: colorFor(entrant.name) }}
                  aria-hidden
                >
                  {initials(entrant.name)}
                </span>
                <span className="truncate">{entrant.name}</span>
                {config.drawMethod === 'seeded' && (
                  <span className="text-xs text-muted-foreground tnum">#{i + 1}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {validation.issues.length > 0 && <IssueList issues={validation.issues} />}

      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            {canGenerate ? <Check className="size-4" /> : <Users className="size-4" />}
          </span>
          <div className="space-y-1 text-sm">
            <p className="font-medium">What happens next</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>Your tournament is created and opens on its dashboard.</li>
              {canGenerate ? (
                <li>
                  {matchCount} {matchCount === 1 ? 'fixture' : 'fixtures'} are generated straight away —
                  you can still redraw or edit them by hand.
                </li>
              ) : (
                <li>
                  Add at least {format.minParticipants} {entrantWord(sport, format.minParticipants)},
                  then generate the fixtures from the Draw page.
                </li>
              )}
              <li>Add squads, schedule matches, then enter results as they come in.</li>
            </ul>
          </div>
        </div>
      </Card>

      {!info.name.trim() && (
        <Badge variant="destructive" className="gap-1.5">
          <Trophy className="size-3" />
          Give your tournament a name before creating it
        </Badge>
      )}
    </div>
  )
}
