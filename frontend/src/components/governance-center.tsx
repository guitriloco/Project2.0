'use client'

import useSWR from 'swr'
import { ShieldCheck, Scale, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DeliberationHub } from './operations/DeliberationHub'
import type { OperationsSummary, Decision } from '@/lib/operations-contracts'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Falha ao carregar governança')
  return response.json()
}

export function GovernanceCenter() {
  const { data, error, mutate } = useSWR<OperationsSummary>('/api/operations/summary', fetcher, {
    refreshInterval: 15000,
  })

  async function handleDecisionCreate(
    action: string,
    rationale: string,
    impact = 'MEDIUM',
    confidence = 0.85,
    threshold = 5
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/operations/decisions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          rationale,
          impact,
          confidence,
          requiredWeightThreshold: threshold,
        }),
      })
      if (!res.ok) return false
      await mutate()
      return true
    } catch {
      return false
    }
  }

  async function handleSign(
    decisionId: string,
    vote: 'APPROVE' | 'REJECT' | 'VETO',
    rationale?: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/operations/decisions/${decisionId}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote, rationale }),
      })
      if (!res.ok) return false
      await mutate()
      return true
    } catch {
      return false
    }
  }

  if (!data && !error) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar a governança deste workspace.
      </p>
    )
  }

  const decisions: Decision[] = data?.decisions.recent ?? []
  const audit = data?.audit?.recent ?? []

  return (
    <section className="flex flex-col gap-6" aria-label="Centro de governança">
      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-primary" />
              Decisões Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold font-mono">{data?.decisions.total ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Com justificativa e prova criptográfica</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Propostas em Governança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold font-mono">{data?.proposals.total ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pipeline sob controle multi-sig</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-primary" />
              Eventos Auditados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold font-mono">{data?.audit?.total ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Trilha imutável selada em cadeia</p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Deliberation Hub */}
      <DeliberationHub
        decisions={decisions}
        onDecisionCreate={handleDecisionCreate}
        onSign={handleSign}
        onRetry={() => mutate()}
      />

      {/* Audit Log Overview */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Trilha Recente de Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {audit.length ? (
            audit.slice(0, 8).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{event.entityTitle}</p>
                  <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                    {event.type} · {event.source}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {event.status}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum evento auditado recente.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
