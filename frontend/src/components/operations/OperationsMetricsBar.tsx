'use client'

import { Activity, CheckCircle2, Database, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface OperationsMetricsBarProps {
  isLoading?: boolean
  isError?: boolean
  taskCount: number
  decisionCount: number
  proposalCount: number
  systemHealth?: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  onRetry?: () => void
}

export function OperationsMetricsBar({
  isLoading = false,
  isError = false,
  taskCount,
  decisionCount,
  proposalCount,
  systemHealth = 'HEALTHY',
}: OperationsMetricsBarProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p className="text-xs font-medium">Métricas operacionais temporariamente indisponíveis.</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Tarefas Ativas',
      value: taskCount,
      detail: 'itens sob acompanhamento',
      Icon: CheckCircle2,
      badge: `${taskCount} rastreadas`,
    },
    {
      label: 'Decisões & Racionais',
      value: decisionCount,
      detail: 'registros auditáveis',
      Icon: Activity,
      badge: 'Governança ativa',
    },
    {
      label: 'Propostas',
      value: proposalCount,
      detail: 'em ciclo deliberativo',
      Icon: Database,
      badge: 'Fase de análise',
    },
    {
      label: 'Saúde do Core',
      value: systemHealth === 'HEALTHY' ? '99.9%' : 'Alerta',
      detail: systemHealth === 'HEALTHY' ? 'Operação nominal' : 'Degradação detectada',
      Icon: ShieldCheck,
      badge: systemHealth === 'HEALTHY' ? 'Estável' : 'Atenção',
      isHealth: true,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ label, value, detail, Icon, badge, isHealth }) => (
        <Card key={label} className="border-border/60 bg-card/60 backdrop-blur-sm transition-all hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </CardTitle>
            <Icon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              <Badge
                variant={isHealth && systemHealth !== 'HEALTHY' ? 'outline' : 'secondary'}
                className={`text-[10px] font-mono ${isHealth && systemHealth !== 'HEALTHY' ? 'text-destructive border-destructive/50' : ''}`}
              >
                {badge}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
