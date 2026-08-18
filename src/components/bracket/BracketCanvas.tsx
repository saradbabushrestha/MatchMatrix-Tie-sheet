import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Match } from '@/types'
import type { TournamentData } from '@/hooks/useTournamentData'
import { MatchNode, type MatchFlowNode } from './MatchNode'
import { buildBracketLayout, NODE_WIDTH } from './layout'
import { computePodium } from '@/engine'
import { cn } from '@/lib/utils'

const nodeTypes = { match: MatchNode }

interface BracketCanvasProps {
  data: TournamentData
  onOpenMatch: (match: Match) => void
  /** Ref to the canvas wrapper, for PNG export. */
  captureRef?: React.RefObject<HTMLDivElement>
  className?: string
  showMiniMap?: boolean
  /** Read-only mode for the public page: no controls, no selection. */
  readOnly?: boolean
}

function BracketCanvasInner({
  data,
  onOpenMatch,
  captureRef,
  className,
  showMiniMap = true,
  readOnly = false,
}: BracketCanvasProps) {
  const { rounds, matches, participantMap, sport, venues } = data
  const { fitView } = useReactFlow()

  const layout = useMemo(() => buildBracketLayout(rounds, matches), [rounds, matches])

  const podium = useMemo(() => computePodium(matches, rounds), [matches, rounds])

  const initialNodes = useMemo<MatchFlowNode[]>(() => {
    // Champion-deciding matches get a trophy marker.
    const decider = rounds.find((r) => r.kind === 'grand_final') ??
      rounds.filter((r) => r.kind === 'winners').sort((a, b) => b.position - a.position)[0]

    return layout.nodes.map((node) => ({
      id: node.id,
      type: 'match' as const,
      position: { x: node.x, y: node.y },
      draggable: false,
      selectable: !readOnly,
      data: {
        match: node.match,
        home: node.match.homeId ? (participantMap.get(node.match.homeId) ?? null) : null,
        away: node.match.awayId ? (participantMap.get(node.match.awayId) ?? null) : null,
        sport,
        roundName: node.round.name,
        venueName: venues.find((v) => v.id === node.match.venueId)?.name ?? null,
        isChampionMatch: node.round.id === decider?.id,
        onOpen: onOpenMatch,
      },
    }))
  }, [layout.nodes, participantMap, sport, venues, rounds, onOpenMatch, readOnly])

  const initialEdges = useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: false,
        className: edge.decided ? 'decided' : undefined,
        style:
          edge.kind === 'loser'
            ? { strokeDasharray: '5 4' }
            : undefined,
      })),
    [layout.edges],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Results change often; keep the canvas in step without losing the viewport.
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || layout.nodes.length === 0) return
    didFit.current = true
    // Wait a frame so nodes are measured before fitting.
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.12, duration: 300, maxZoom: 1 })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [fitView, layout.nodes.length])

  const nodeColor = useCallback(
    (node: MatchFlowNode) => {
      const match = node.data.match
      if (match.status === 'completed' || match.status === 'walkover') return 'hsl(158 64% 45%)'
      if (match.status === 'live') return 'hsl(0 72% 55%)'
      return 'hsl(220 14% 40%)'
    },
    [],
  )

  return (
    <div ref={captureRef} className={cn('relative size-full bg-background', className)}>
      {/* Round headers, pinned above the canvas so columns stay labelled */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden overflow-hidden md:block">
        <div className="flex gap-[76px] px-4 pt-2 opacity-0">
          {layout.columns.map((column) => (
            <span key={column.label} style={{ width: NODE_WIDTH }} />
          ))}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={!readOnly}
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} className="opacity-50" />
        {!readOnly && <Controls showInteractive={false} position="bottom-right" />}
        {showMiniMap && layout.nodes.length > 8 && (
          <MiniMap
            nodeColor={nodeColor}
            nodeStrokeWidth={0}
            pannable
            zoomable
            position="top-right"
            className="hidden sm:block"
          />
        )}
      </ReactFlow>

      {podium.champion && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-warning/40 bg-card/95 px-3 py-2 shadow-card backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Champion
          </p>
          <p className="text-sm font-bold">
            🏆 {participantMap.get(podium.champion)?.name ?? 'Unknown'}
          </p>
        </div>
      )}
    </div>
  )
}

/** The bracket canvas. Wraps its own provider so it can be dropped in anywhere. */
export function BracketCanvas(props: BracketCanvasProps) {
  return (
    <ReactFlowProvider>
      <BracketCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
