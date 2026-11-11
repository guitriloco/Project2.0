'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { RefreshCw, CheckCircle2, AlertCircle, Radio, Wifi, WifiOff, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OperationsMetricsBar } from './operations/OperationsMetricsBar'
import { TaskKanbanList } from './operations/TaskKanbanList'
import { DeliberationHub } from './operations/DeliberationHub'
import { AgentConsole } from './xerebro/AgentConsole'
import { IntegrationWebhookModal } from './operations/IntegrationWebhookModal'
import { ActivityHistory } from '@/components/operational-center-sections'
import { useOperationsStream } from '@/hooks/use-operations-stream'
import type { AuditEvent, OperationsSummary, Task, Decision } from '@/lib/operations-contracts'

const previewSummary: OperationsSummary = {
  generatedAt: new Date().toISOString(),
  tasks: { total: 0, recent: [] },
  decisions: { total: 0, recent: [] },
  proposals: { total: 0 },
  audit: { total: 0, recent: [] },
}

const fetcher = (url: string): Promise<OperationsSummary> =>
  fetch(url)
    .then(async (res) => {
      if (!res.ok) return previewSummary
      return res.json()
    })
    .catch(() => previewSummary)

export function OperationalCenter() {
  const { data, error, isLoading, mutate } = useSWR<OperationsSummary>(
    '/api/operations/summary',
    fetcher,
    { revalidateOnFocus: true }
  )

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false)

  function showNotification(type: 'success' | 'error', text: string) {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  // Real-time SSE telemetry synchronization
  const { status: streamStatus, lastEventTime } = useOperationsStream({
    onTaskCreated: (newTask) => {
      mutate((current) => {
        if (!current) return current
        const exists = current.tasks?.recent?.some((t) => t.id === newTask.id)
        if (exists) return current
        const updatedRecent = [newTask, ...(current.tasks?.recent || [])].slice(0, 10)
        return {
          ...current,
          tasks: {
            ...current.tasks,
            total: (current.tasks?.total || 0) + 1,
            recent: updatedRecent,
          },
        }
      }, false)
    },
    onTaskUpdated: (updatedTask) => {
      mutate((current) => {
        if (!current) return current
        const updatedRecent = (current.tasks?.recent || []).map((t) =>
          t.id === updatedTask.id ? { ...t, ...updatedTask } : t
        )
        return {
          ...current,
          tasks: {
            ...current.tasks,
            recent: updatedRecent,
          },
        }
      }, false)
    },
    onTaskDeleted: ({ taskId }) => {
      mutate((current) => {
        if (!current) return current
        const updatedRecent = (current.tasks?.recent || []).filter((t) => t.id !== taskId)
        return {
          ...current,
          tasks: {
            ...current.tasks,
            total: Math.max(0, (current.tasks?.total || 0) - 1),
            recent: updatedRecent,
          },
        }
      }, false)
    },
    onDecisionLogged: (newDecision) => {
      mutate((current) => {
        if (!current) return current
        const exists = current.decisions?.recent?.some((d) => d.id === newDecision.id)
        if (exists) return current
        const updatedRecent = [newDecision, ...(current.decisions?.recent || [])].slice(0, 10)
        return {
          ...current,
          decisions: {
            ...current.decisions,
            total: (current.decisions?.total || 0) + 1,
            recent: updatedRecent,
          },
        }
      }, false)
    },
    onDecisionVoted: ({ decision }) => {
      mutate((current) => {
        if (!current) return current
        const updatedRecent = (current.decisions?.recent || []).map((d) =>
          d.id === decision.id ? { ...d, ...decision } : d
        )
        return {
          ...current,
          decisions: {
            ...current.decisions,
            recent: updatedRecent,
          },
        }
      }, false)
    },
    onAuditRecorded: (newAudit) => {
      mutate((current) => {
        if (!current) return current
        const updatedRecent = [newAudit, ...(current.audit?.recent || [])].slice(0, 20)
        return {
          ...current,
          audit: {
            ...current.audit,
            total: (current.audit?.total || 0) + 1,
            recent: updatedRecent,
          },
        }
      }, false)
    },
  })

  // Optimistic task creation
  const handleCreateTask = useCallback(
    async (title: string): Promise<boolean> => {
      const optimisticTask: Task = {
        id: `optimistic-${Date.now()}`,
        title,
        status: 'PENDING',
        workspaceId: data?.workspace?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Optimistic cache update
      await mutate(
        (current) => {
          if (!current) return current
          return {
            ...current,
            tasks: {
              ...current.tasks,
              total: (current.tasks?.total || 0) + 1,
              recent: [optimisticTask, ...(current.tasks?.recent || [])],
            },
          }
        },
        { revalidate: false }
      )

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, status: 'PENDING' }),
        })

        if (!response.ok) {
          const problem = await response.json().catch(() => null)
          showNotification(
            'error',
            problem?.detail || 'Não foi possível criar a tarefa.'
          )
          await mutate() // Rollback
          return false
        }

        const createdTask = await response.json()
        showNotification('success', 'Tarefa criada com sucesso.')

        // Reconcile optimistic item with server item
        await mutate((current) => {
          if (!current) return current
          const replaced = (current.tasks?.recent || []).map((t) =>
            t.id === optimisticTask.id ? createdTask : t
          )
          return {
            ...current,
            tasks: { ...current.tasks, recent: replaced },
          }
        }, false)

        return true
      } catch {
        showNotification('error', 'Falha de comunicação ao criar a tarefa.')
        await mutate() // Rollback
        return false
      }
    },
    [data, mutate]
  )

  // Optimistic task completion
  const handleCompleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      const originalData = data

      // Optimistic update
      await mutate(
        (current) => {
          if (!current) return current
          const updated = (current.tasks?.recent || []).map((t) =>
            t.id === id ? { ...t, status: 'COMPLETED' as const } : t
          )
          return {
            ...current,
            tasks: { ...current.tasks, recent: updated },
          }
        },
        { revalidate: false }
      )

      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        })

        if (!response.ok) {
          const problem = await response.json().catch(() => null)
          showNotification(
            'error',
            problem?.detail || 'Não foi possível atualizar a tarefa.'
          )
          await mutate(originalData, false) // Rollback
          return false
        }

        showNotification('success', 'Tarefa concluída.')
        return true
      } catch {
        showNotification('error', 'Falha de comunicação ao atualizar a tarefa.')
        await mutate(originalData, false) // Rollback
        return false
      }
    },
    [data, mutate]
  )

  // Optimistic decision creation
  const handleCreateDecision = useCallback(
    async (
      action: string,
      rationale: string,
      impact = 'MEDIUM',
      confidence = 0.85
    ): Promise<boolean> => {
      const optimisticDecision: Decision = {
        id: `optimistic-${Date.now()}`,
        action,
        title: action,
        rationale,
        context: rationale,
        impact,
        impactLevel: impact,
        confidence,
        status: 'LOGGED',
        workspaceId: data?.workspace?.id,
        createdAt: new Date().toISOString(),
      }

      await mutate(
        (current) => {
          if (!current) return current
          return {
            ...current,
            decisions: {
              ...current.decisions,
              total: (current.decisions?.total || 0) + 1,
              recent: [optimisticDecision, ...(current.decisions?.recent || [])],
            },
          }
        },
        { revalidate: false }
      )

      try {
        const response = await fetch('/api/decisions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action,
            rationale,
            impact,
            confidence,
            status: 'LOGGED',
          }),
        })

        if (!response.ok) {
          const problem = await response.json().catch(() => null)
          showNotification(
            'error',
            problem?.detail || 'Não foi possível registrar a decisão.'
          )
          await mutate() // Rollback
          return false
        }

        const created = await response.json()
        showNotification('success', 'Decisão registrada na trilha imutável.')

        await mutate((current) => {
          if (!current) return current
          const replaced = (current.decisions?.recent || []).map((d) =>
            d.id === optimisticDecision.id ? created : d
          )
          return {
            ...current,
            decisions: { ...current.decisions, recent: replaced },
          }
        }, false)

        return true
      } catch {
        showNotification('error', 'Falha de comunicação ao registrar decisão.')
        await mutate() // Rollback
        return false
      }
    },
    [data, mutate]
  )

  // Deliberation vote casting
  const handleVote = useCallback(
    async (
      decisionId: string,
      support: boolean,
      rationale?: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/decisions/${encodeURIComponent(decisionId)}/votes`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ support, rationale }),
          }
        )

        if (!response.ok) {
          const problem = await response.json().catch(() => null)
          showNotification(
            'error',
            problem?.detail || 'Não foi possível registrar o voto.'
          )
          return false
        }

        const updated = await response.json()
        showNotification(
          'success',
          support ? 'Voto favorável computado.' : 'Voto contrário computado.'
        )

        await mutate((current) => {
          if (!current) return current
          const updatedRecent = (current.decisions?.recent || []).map((d) =>
            d.id === decisionId ? updated : d
          )
          return {
            ...current,
            decisions: { ...current.decisions, recent: updatedRecent },
          }
        }, false)

        return true
      } catch {
        showNotification('error', 'Falha de comunicação ao computar voto.')
        return false
      }
    },
    [mutate]
  )

  const taskCount = data?.tasks?.total ?? 0
  const decisionCount = data?.decisions?.total ?? 0
  const proposalCount = data?.proposals?.total ?? 0
  const recentTasks = data?.tasks?.recent ?? []
  const recentDecisions = data?.decisions?.recent ?? []

  const activity = (data?.audit?.recent ?? []).map((event: AuditEvent) => ({
    id: event.id,
    type: event.type.startsWith('TASK_')
      ? 'Tarefa'
      : event.type.startsWith('DECISION_')
      ? 'Decisão'
      : 'Segurança',
    label:
      event.type === 'TASK_COMPLETED'
        ? 'Tarefa concluída'
        : event.type === 'TASK_CREATED'
        ? 'Tarefa criada'
        : event.type === 'TASK_DELETED'
        ? 'Tarefa excluída'
        : event.type === 'DECISION_LOGGED'
        ? 'Decisão registrada'
        : event.type === 'DECISION_VOTED'
        ? 'Voto computado'
        : 'Evento de auditoria',
    detail: event.entityTitle,
    status: event.status,
    source: event.source,
    date: event.createdAt,
    rationale:
      typeof event.details?.rationale === 'string'
        ? event.details.rationale
        : undefined,
    confidence:
      typeof event.details?.confidence === 'number'
        ? event.details.confidence
        : undefined,
  }))

  return (
    <section className="flex flex-col gap-6" aria-label="Centro operacional">
      {/* Top Header with Real-time Telemetry Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs">
            {streamStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono">
                <Wifi className="h-3.5 w-3.5" />
                <span>SSE Ativo</span>
                {lastEventTime && (
                  <span className="text-muted-foreground tabular-nums">
                    · {new Date(lastEventTime).toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </span>
            ) : streamStatus === 'connecting' ? (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span>Reconectando stream...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground font-mono">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Polling em espera</span>
              </span>
            )}
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {data?.workspace?.name || 'Workspace Operacional'}
            </p>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Centro de Comando & Governança em Tempo Real
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsIntegrationModalOpen(true)}
            className="h-8 text-xs font-medium"
          >
            <Webhook className="mr-1.5 h-3.5 w-3.5" />
            Integrações & Webhooks
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            className="h-8 text-xs font-medium"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <Card
          className={`border ${
            notification.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <CardContent className="flex items-center gap-2.5 p-3 text-xs font-medium">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.text}</span>
          </CardContent>
        </Card>
      )}

      {/* Metrics Bar */}
      <OperationsMetricsBar
        isLoading={isLoading}
        isError={!!error}
        taskCount={taskCount}
        decisionCount={decisionCount}
        proposalCount={proposalCount}
        systemHealth={error ? 'DEGRADED' : 'HEALTHY'}
        onRetry={() => mutate()}
      />

      {/* Work Grid: Tasks & Deliberation Hub */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TaskKanbanList
          tasks={recentTasks}
          isLoading={isLoading}
          isError={!!error}
          onTaskCreate={handleCreateTask}
          onTaskComplete={handleCompleteTask}
          onRetry={() => mutate()}
        />

        <DeliberationHub
          decisions={recentDecisions}
          isLoading={isLoading}
          isError={!!error}
          onDecisionCreate={handleCreateDecision}
          onVote={handleVote}
          onRetry={() => mutate()}
        />
      </div>

      {/* Autonomous AI Copilot with Human-in-the-Loop Authorization */}
      <AgentConsole
        workspaceName={data?.workspace?.name}
        onActionExecuted={() => mutate()}
      />

      {/* Audit History Timeline */}
      <ActivityHistory
        activity={activity}
        expandedActivity={expandedActivity}
        onToggle={setExpandedActivity}
      />

      {/* Integration, Webhooks & Enterprise Sandbox Modal */}
      <IntegrationWebhookModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
        workspaceId={data?.workspace?.id}
      />
    </section>
  )
}
