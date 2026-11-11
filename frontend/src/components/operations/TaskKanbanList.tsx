'use client'

import { useState } from 'react'
import { CheckCircle2, Clock3, Plus, AlertCircle, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { OperationalEmptyState } from './OperationalEmptyState'
import type { TaskItem } from '@/lib/operations-contracts'

interface TaskKanbanListProps {
  tasks: TaskItem[]
  isLoading?: boolean
  isError?: boolean
  onTaskCreate: (title: string) => Promise<boolean>
  onTaskComplete: (id: string) => Promise<boolean>
  onRetry?: () => void
}

export function TaskKanbanList({
  tasks,
  isLoading = false,
  isError = false,
  onTaskCreate,
  onTaskComplete,
  onRetry,
}: TaskKanbanListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<string>('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = newTitle.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    const success = await onTaskCreate(trimmed)
    if (success) setNewTitle('')
    setIsSubmitting(false)
  }

  async function handleComplete(id: string) {
    if (completingId) return
    setCompletingId(id)
    await onTaskComplete(id)
    setCompletingId(null)
  }

  const filteredTasks = filter === 'ALL'
    ? tasks
    : tasks.filter((t) => t.status === filter)

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Fluxo de Trabalho & Tarefas</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Execução tática com rastreabilidade</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrar tarefas"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background/80 px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Todas as tarefas ({tasks.length})</option>
            <option value="PENDING">Pendentes</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluídas</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Task Creation Input */}
        <div className="flex gap-2">
          <Input
            aria-label="Título da nova tarefa"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                handleCreate()
              }
            }}
            placeholder="Nova tarefa operacional... (Pressione Enter)"
            className="h-9 text-xs"
            disabled={isSubmitting}
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newTitle.trim() || isSubmitting}
            className="h-9 shrink-0 text-xs px-3"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {isSubmitting ? 'Salvando...' : 'Adicionar'}
          </Button>
        </div>

        {/* State: Loading */}
        {isLoading && (
          <div className="flex flex-col gap-2 pt-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        )}

        {/* State: Error */}
        {!isLoading && isError && (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Falha ao carregar tarefas.</span>
            </div>
            {onRetry && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRetry}>
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {/* State: Empty */}
        {!isLoading && !isError && filteredTasks.length === 0 && (
          <OperationalEmptyState
            title="Nenhuma tarefa encontrada"
            description={
              filter === 'ALL'
                ? 'Comece adicionando a primeira tarefa operacional no campo acima.'
                : `Não existem tarefas com o status "${filter}".`
            }
          />
        )}

        {/* State: Content List */}
        {!isLoading && !isError && filteredTasks.length > 0 && (
          <div className="flex flex-col divide-y divide-border/50 overflow-y-auto max-h-[380px] pr-1">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-xs font-medium truncate ${
                        task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.priority && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {task.priority}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    <span>{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('pt-BR') : 'Recente'}</span>
                    <span>•</span>
                    <Badge
                      variant={task.status === 'COMPLETED' ? 'secondary' : 'outline'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {task.status}
                    </Badge>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {task.status !== 'COMPLETED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleComplete(task.id)}
                      disabled={completingId === task.id}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Concluir tarefa"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {completingId === task.id ? 'Concluindo...' : 'Concluir'}
                    </Button>
                  )}
                  {task.status === 'COMPLETED' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
