'use client'

import useSWR from 'swr'
import { Activity, CheckCircle2, Database, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { OperationsSummary } from '@/lib/operations-contracts'

const previewSummary: OperationsSummary = {
  generatedAt: new Date().toISOString(),
  tasks: { total: 0 },
  decisions: { total: 0 },
  proposals: { total: 0 },
  audit: { total: 0 },
}

const fetcher = async (url: string): Promise<OperationsSummary> => {
  const response = await fetch(url)
  if (!response.ok) return previewSummary
  const payload = await response.json()
  return payload?.tasks && payload?.decisions && payload?.proposals ? payload : previewSummary
}

export function ExecutivePanel() {
  const { data, error } = useSWR<OperationsSummary>('/api/operations/summary', fetcher, { refreshInterval: 30000 })
  if (!data && !error) return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
  if (error) return <p role="alert" className="text-sm text-destructive">Não foi possível carregar os indicadores executivos.</p>
  const metrics = [{ label: 'Tarefas totais', value: data?.tasks.total ?? 0, detail: 'carga operacional', Icon: CheckCircle2 }, { label: 'Decisões', value: data?.decisions.total ?? 0, detail: 'registros auditáveis', Icon: Activity }, { label: 'Propostas', value: data?.proposals.total ?? 0, detail: 'pipeline de governança', Icon: Database }, { label: 'Eventos auditados', value: data?.audit?.total ?? 0, detail: 'rastro de atividade', Icon: Users }]
  return <section className="flex flex-col gap-6" aria-label="Painel executivo"><div><p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Visão executiva</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">O pulso da operação em uma leitura</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Indicadores derivados do estado persistido do workspace, atualizados automaticamente.</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{metrics.map(({ label, value, detail, Icon }) => <Card key={label}><CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="size-4 text-primary" /></CardHeader><CardContent><p className="text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle className="text-base">Leitura executiva</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-3"><p><strong className="text-foreground">Operação:</strong> {data?.tasks.total ? 'há trabalho registrado para acompanhar.' : 'ainda não há tarefas registradas.'}</p><p><strong className="text-foreground">Governança:</strong> {data?.decisions.total || data?.proposals.total ? 'decisões e propostas já formam um histórico.' : 'o histórico de governança está vazio.'}</p><p><strong className="text-foreground">Controle:</strong> {data?.audit?.total ? 'a operação está deixando rastros auditáveis.' : 'nenhum evento de auditoria foi registrado.'}</p></CardContent></Card></section>
}
