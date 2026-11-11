'use client'

import { useState } from 'react'
import { Activity, Plus, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { OperationalEmptyState } from './OperationalEmptyState'
import type { DecisionItem } from '@/lib/operations-contracts'

interface DecisionAuditFeedProps {
  decisions: DecisionItem[]
  isLoading?: boolean
  isError?: boolean
  onDecisionCreate: (action: string, rationale: string) => Promise<boolean>
  onRetry?: () => void
}

export function DecisionAuditFeed({
  decisions,
  isLoading = false,
  isError = false,
  onDecisionCreate,
  onRetry,
}: DecisionAuditFeedProps) {
  const [action, setAction] = useState('')
  const [rationale, setRationale] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleSubmit() {
    if (!action.trim() || !rationale.trim() || isSubmitting) return
    setIsSubmitting(true)
    const success = await onDecisionCreate(action.trim(), rationale.trim())
    if (success) {
      setAction('')
      setRationale('')
      setShowForm(false)
    }
    setIsSubmitting(false)
  }

  const filteredDecisions = filter === 'ALL'
    ? decisions
    : decisions.filter((d) => d.status === filter)

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Trilha de Decisões & Governança</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Racionais arquiteturais com auditoria persistente</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrar decisões"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background/80 px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Todas as decisões ({decisions.length})</option>
            <option value="LOGGED">Registradas</option>
            <option value="APPROVED">Aprovadas</option>
            <option value="REJECTED">Rejeitadas</option>
          </select>
          <Button
            size="sm"
            variant={showForm ? 'default' : 'outline'}
            onClick={() => setShowForm(!showForm)}
            className="h-8 text-xs px-2.5"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {showForm ? 'Fechar' : 'Nova Decisão'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Expandable Decision Logging Form */}
        {showForm && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3 transition-all">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">Registrar Deliberação Operacional</h4>
            <Input
              aria-label="Ação da decisão"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ação executada (ex: Promover migração de schema DB v2)"
              className="h-8 text-xs bg-background/80"
              disabled={isSubmitting}
            />
            <Textarea
              aria-label="Justificativa da decisão"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Racional técnico, impacto esperado e mitigação de riscos..."
              rows={3}
              className="text-xs bg-background/80 resize-none"
              disabled={isSubmitting}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="h-7 text-xs"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!action.trim() || !rationale.trim() || isSubmitting}
                className="h-7 text-xs"
              >
                {isSubmitting ? 'Gravando...' : 'Gravar Decisão'}
              </Button>
            </div>
          </div>
        )}

        {/* State: Loading */}
        {isLoading && (
          <div className="flex flex-col gap-2 pt-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        )}

        {/* State: Error */}
        {!isLoading && isError && (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Falha ao carregar decisões.</span>
            </div>
            {onRetry && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRetry}>
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {/* State: Empty */}
        {!isLoading && !isError && filteredDecisions.length === 0 && (
          <OperationalEmptyState
            title="Nenhuma decisão registrada"
            description={
              filter === 'ALL'
                ? 'Registre sua primeira decisão operacional clicando em "Nova Decisão".'
                : `Não existem decisões com o status "${filter}".`
            }
            icon={FileText}
            actionLabel="Registrar Decisão"
            onAction={() => setShowForm(true)}
          />
        )}

        {/* State: Content List */}
        {!isLoading && !isError && filteredDecisions.length > 0 && (
          <div className="flex flex-col divide-y divide-border/50 overflow-y-auto max-h-[380px] pr-1">
            {filteredDecisions.map((decision) => {
              const isExpanded = expandedId === decision.id
              return (
                <div key={decision.id} className="py-3 first:pt-1 last:pb-1 group">
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : decision.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="text-xs font-medium truncate text-foreground">{decision.action}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{decision.createdAt ? new Date(decision.createdAt).toLocaleDateString('pt-BR') : 'Data recente'}</span>
                        <span>•</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {decision.status}
                        </Badge>
                        {typeof decision.confidence === 'number' && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            {Math.round(decision.confidence * 100)}% confiança
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground space-y-1.5 border border-border/40">
                      <div>
                        <span className="font-semibold text-foreground">Justificativa / Racional:</span>
                        <p className="mt-0.5 leading-relaxed">{decision.rationale || 'Nenhuma justificativa detalhada registrada.'}</p>
                      </div>
                      {decision.impact && (
                        <div>
                          <span className="font-semibold text-foreground">Impacto Esperado:</span>
                          <p className="mt-0.5 leading-relaxed">{decision.impact}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground font-mono">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        <span>Auditável pelo Xerebro Core ID: {decision.id.slice(0, 12)}...</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
