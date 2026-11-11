'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActivityItem = {
  id: string
  type: string
  label: string
  detail: string
  status: string
  source: string
  date?: string
  rationale?: string
  confidence?: number
}

export function MetricsCards({ metrics }: { metrics: { label: string; value: number; detail: string; Icon: LucideIcon }[] }) {
  return <div className="grid gap-4 md:grid-cols-3">{metrics.map(({ label, value, detail, Icon }) => <Card key={label}><CardHeader className="flex flex-row items-center justify-between gap-4 pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="text-primary" /></CardHeader><CardContent><p className="text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}</div>
}

export function ActivityHistory({ activity, expandedActivity, onToggle }: { activity: ActivityItem[]; expandedActivity: string | null; onToggle: (id: string | null) => void }) {
  return <Card><CardHeader><CardTitle>Histórico de atividade</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{activity.length ? activity.map((item) => <details key={item.id} open={expandedActivity === item.id} onToggle={(event) => onToggle(event.currentTarget.open ? item.id : null)} className="rounded-md border border-border/60 px-3 py-2"><summary className="flex cursor-pointer list-none items-start gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-medium">{item.label}</span><span className="block truncate text-sm text-muted-foreground">{item.detail}</span></span></summary><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"><span>Tipo: {item.type}</span><span>Status: {item.status}</span><span>Origem: {item.source}</span>{item.date && <span>Data: {new Date(item.date).toLocaleString('pt-BR')}</span>}{item.rationale && <p className="basis-full text-sm leading-relaxed text-foreground">Justificativa: {item.rationale}</p>}{typeof item.confidence === 'number' && <span>Confiança: {Math.round(item.confidence * 100)}%</span>}</div></details>) : <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>}</CardContent></Card>
}
