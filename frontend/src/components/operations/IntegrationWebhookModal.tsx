'use client'

import { useState, useEffect } from 'react'
import {
  Webhook,
  Download,
  Trash2,
  Send,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  FileCode,
  Layers,
  Play,
  RotateCcw,
  Clock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export interface WebhookSubscriptionItem {
  id: string
  targetUrl: string
  events: string[]
  secret: string
  active: boolean
  createdAt: string
  lastDeliveryAt?: string
  lastDeliveryStatus?: number
  lastDeliveryError?: string
}

export interface WebhookDeliveryAttempt {
  attemptNumber: number
  timestamp: string
  statusCode?: number
  errorMessage?: string
  durationMs: number
}

export interface WebhookQueuedDeliveryItem {
  id: string
  subscriptionId: string
  workspaceId: string
  targetUrl: string
  event: {
    id: string
    type: string
    timestamp: string
    data?: any
  }
  idempotencyKey: string
  status: 'PENDING' | 'RETRYING' | 'DELIVERED' | 'DEAD_LETTER'
  attempts: WebhookDeliveryAttempt[]
  maxAttempts: number
  nextRetryAt: string | null
  createdAt: string
  completedAt?: string
}

export interface SandboxModule {
  id: string
  name: string
  phase: number
  category: string
  status: string
  description: string
}

export interface IntegrationWebhookModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
}

export function IntegrationWebhookModal({
  isOpen,
  onClose,
  workspaceId,
}: IntegrationWebhookModalProps) {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'deliveries' | 'export' | 'sandbox'>('webhooks')
  const [webhooks, setWebhooks] = useState<WebhookSubscriptionItem[]>([])
  const [deliveries, setDeliveries] = useState<WebhookQueuedDeliveryItem[]>([])
  const [targetUrl, setTargetUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'task:created',
    'decision:logged',
    'audit:recorded',
  ])
  const [isRegistering, setIsRegistering] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [replayingId, setReplayingId] = useState<string | null>(null)
  const [purgingId, setPurgingId] = useState<string | null>(null)
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false)
  const [sandboxModules, setSandboxModules] = useState<SandboxModule[]>([])
  const [simulatingId, setSimulatingId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showNotification(type: 'success' | 'error', text: string) {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  async function fetchWebhooks() {
    try {
      const res = await fetch('/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data)
      }
    } catch {
      // quiet
    }
  }

  async function fetchDeliveries() {
    setIsLoadingDeliveries(true)
    try {
      const res = await fetch('/api/webhooks/deliveries')
      if (res.ok) {
        const data = await res.json()
        setDeliveries(data)
      }
    } catch {
      // quiet
    } finally {
      setIsLoadingDeliveries(false)
    }
  }

  async function fetchSandboxModules() {
    try {
      const res = await fetch('/api/sandbox/modules')
      if (res.ok) {
        const data = await res.json()
        setSandboxModules(data.modules || [])
      }
    } catch {
      // quiet
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchWebhooks()
      fetchDeliveries()
      fetchSandboxModules()
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleRegisterWebhook(e: React.FormEvent) {
    e.preventDefault()
    if (!targetUrl.trim() || selectedEvents.length === 0 || isRegistering) return

    setIsRegistering(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          events: selectedEvents,
        }),
      })

      if (!res.ok) {
        const problem = await res.json().catch(() => null)
        showNotification('error', problem?.detail || 'Falha ao registrar webhook.')
        return
      }

      showNotification('success', 'Webhook registrado com assinatura HMAC-SHA256.')
      setTargetUrl('')
      await fetchWebhooks()
    } catch {
      showNotification('error', 'Erro de comunicação ao registrar webhook.')
    } finally {
      setIsRegistering(false)
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        showNotification('success', 'Inscrição de webhook removida.')
        await fetchWebhooks()
      }
    } catch {
      showNotification('error', 'Falha ao excluir webhook.')
    }
  }

  async function handleTestPing(id: string) {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/${encodeURIComponent(id)}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        showNotification('success', `Ping entregue com sucesso (HTTP ${data.delivery?.status}).`)
      } else {
        showNotification('error', `Falha na entrega: ${data.delivery?.error || 'Erro desconhecido'}`)
      }
      await fetchWebhooks()
      await fetchDeliveries()
    } catch {
      showNotification('error', 'Falha ao testar webhook.')
    } finally {
      setTestingId(null)
    }
  }

  async function handleReplayDelivery(deliveryId: string) {
    setReplayingId(deliveryId)
    try {
      const res = await fetch(`/api/webhooks/dlq/${encodeURIComponent(deliveryId)}/replay`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        showNotification('success', 'Re-execução de entrega disparada com sucesso!')
        await fetchDeliveries()
      } else {
        showNotification('error', data.detail || 'Falha ao re-executar entrega.')
      }
    } catch {
      showNotification('error', 'Erro ao solicitar re-execução da entrega.')
    } finally {
      setReplayingId(null)
    }
  }

  async function handlePurgeDelivery(deliveryId: string) {
    setPurgingId(deliveryId)
    try {
      const res = await fetch(`/api/webhooks/dlq/${encodeURIComponent(deliveryId)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        showNotification('success', 'Registro expurgado da Dead Letter Queue.')
        await fetchDeliveries()
      } else {
        showNotification('error', 'Falha ao expurgar entrega.')
      }
    } catch {
      showNotification('error', 'Erro ao expurgar registro da DLQ.')
    } finally {
      setPurgingId(null)
    }
  }

  async function handleSimulateSandbox(moduleId: string) {
    setSimulatingId(moduleId)
    try {
      const res = await fetch(`/api/sandbox/simulate/${encodeURIComponent(moduleId)}`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        showNotification('success', `Simulação do módulo '${data.module.name}' concluída no Sandbox.`)
      }
    } catch {
      showNotification('error', 'Falha ao executar simulação.')
    } finally {
      setSimulatingId(null)
    }
  }

  function toggleEvent(evt: string) {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    )
  }

  const dlqCount = deliveries.filter((d) => d.status === 'DEAD_LETTER').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Integrações e Webhooks"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Integrações, Webhooks & Resiliência
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Assinatura HMAC-SHA256, Fila com Backoff Exponencial & DLQ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-5 pt-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'webhooks'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Webhooks de Saída
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('deliveries')
              fetchDeliveries()
            }}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'deliveries'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Fila & DLQ</span>
            {dlqCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-1.5 py-0.2 text-[10px] font-bold text-destructive">
                {dlqCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'export'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Exportar Auditoria (NDJSON / CSV)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sandbox'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Sandbox Conceitual
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mx-5 mt-3 flex items-center gap-2 rounded-md border p-2.5 text-xs font-medium ${
              notification.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'webhooks' && (
            <div className="space-y-5">
              {/* Registration Form */}
              <form
                onSubmit={handleRegisterWebhook}
                className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5"
              >
                <div className="text-xs font-semibold text-foreground">
                  Cadastrar Novo Endpoint de Webhook
                </div>

                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://seu-servidor.com/webhook/xerebro"
                  disabled={isRegistering}
                  className="h-8 text-xs bg-background"
                />

                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="text-muted-foreground">Eventos Subscritos:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'task:created', label: 'Tarefas Criadas' },
                      { id: 'task:updated', label: 'Tarefas Atualizadas' },
                      { id: 'decision:logged', label: 'Decisões Registradas' },
                      { id: 'audit:recorded', label: 'Eventos de Auditoria' },
                    ].map((evt) => (
                      <label
                        key={evt.id}
                        className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(evt.id)}
                          onChange={() => toggleEvent(evt.id)}
                          className="rounded border-border"
                        />
                        <span>{evt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={isRegistering || !targetUrl.trim() || selectedEvents.length === 0}
                    size="sm"
                    className="h-8 text-xs font-medium"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Salvar Webhook
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Subscriptions Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Endpoints Ativos ({webhooks.length})</span>
                  <span className="text-[11px] text-muted-foreground font-mono">Assinatura: sha256</span>
                </div>

                {webhooks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    Nenhum webhook cadastrado para este workspace.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {webhooks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-foreground truncate max-w-[280px]">
                            {sub.targetUrl}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={testingId === sub.id}
                              onClick={() => handleTestPing(sub.id)}
                              className="h-6 text-[11px] px-2"
                            >
                              {testingId === sub.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="mr-1 h-3 w-3" />
                              )}
                              Testar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteWebhook(sub.id)}
                              className="h-6 text-[11px] px-2 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                            Chave: {sub.secret.slice(0, 10)}...
                          </span>
                          <span>•</span>
                          <span>{sub.events.join(', ')}</span>
                          {sub.lastDeliveryStatus !== undefined && (
                            <>
                              <span>•</span>
                              <span
                                className={
                                  sub.lastDeliveryStatus >= 200 && sub.lastDeliveryStatus < 300
                                    ? 'text-emerald-500 font-medium'
                                    : 'text-destructive font-medium'
                                }
                              >
                                Último Status: HTTP {sub.lastDeliveryStatus}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Fila de Entregas & Dead Letter Queue (DLQ)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Retentativas exponenciais automáticas com jitter e isolamento de falhas
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchDeliveries}
                  disabled={isLoadingDeliveries}
                  className="h-7 text-xs px-2"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${isLoadingDeliveries ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              {deliveries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  Nenhuma entrega registrada na fila até o momento.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {deliveries.map((d) => {
                    const isDeadLetter = d.status === 'DEAD_LETTER'
                    const isDelivered = d.status === 'DELIVERED'
                    const isRetrying = d.status === 'RETRYING'

                    return (
                      <div
                        key={d.id}
                        className={`flex flex-col gap-2 rounded-lg border p-3 text-xs ${
                          isDeadLetter
                            ? 'border-destructive/40 bg-destructive/5'
                            : isDelivered
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-amber-500/30 bg-amber-500/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  isDelivered
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : isDeadLetter
                                    ? 'bg-destructive/20 text-destructive'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {isDelivered ? 'Entregue' : isDeadLetter ? 'Dead Letter (DLQ)' : 'Re-tentando'}
                              </span>
                              <span className="font-mono text-muted-foreground text-[10px]">
                                Evento: {d.event.type}
                              </span>
                            </div>
                            <span className="font-mono text-foreground truncate max-w-[360px] text-[11px] pt-1">
                              {d.targetUrl}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDeadLetter && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={replayingId === d.id}
                                  onClick={() => handleReplayDelivery(d.id)}
                                  className="h-6 text-[11px] px-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  {replayingId === d.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                  )}
                                  Replay
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={purgingId === d.id}
                                  onClick={() => handlePurgeDelivery(d.id)}
                                  className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-destructive"
                                >
                                  {purgingId === d.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Attempts details */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <span>
                            Tentativas: <strong>{d.attempts.length}/{d.maxAttempts}</strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[10px]">
                            Idempotency: {d.idempotencyKey.slice(0, 12)}...
                          </span>
                          {d.attempts.length > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                Último erro:{' '}
                                <span className="text-destructive font-mono">
                                  {d.attempts[d.attempts.length - 1]?.errorMessage || 'N/A'}
                                </span>
                              </span>
                            </>
                          )}
                          {isRetrying && d.nextRetryAt && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400">
                                Próxima tentativa: {new Date(d.nextRetryAt).toLocaleTimeString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Download className="h-4 w-4 text-primary" />
                  <span>Exportação de Livro-Razão de Auditoria</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exporte os registros imutáveis de governança, tarefas e decisões do workspace ativo.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href="/api/audit/export?format=csv"
                  download
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 text-left"
                >
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Exportar CSV (RFC 4180)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Planilhas compatíveis com Excel, Google Sheets e ferramentas de BI corporativo.
                  </p>
                  <Button size="sm" variant="outline" className="h-8 text-xs mt-2 w-full">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar CSV
                  </Button>
                </a>

                <a
                  href="/api/audit/export?format=ndjson"
                  download
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 text-left"
                >
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <FileCode className="h-4 w-4" />
                    <span>Exportar NDJSON (Streaming)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Newline-delimited JSON ideal para ingestão em pipelines Elasticsearch, Datadog ou SIEM.
                  </p>
                  <Button size="sm" variant="outline" className="h-8 text-xs mt-2 w-full">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar NDJSON
                  </Button>
                </a>
              </div>
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Enterprise Sandbox (Módulos Históricos Isolados)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Camadas conceituais preservadas em ambiente de sandbox estritamente isolado da produção.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {sandboxModules.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-semibold text-foreground">
                        <span>{m.name}</span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          · Fase {m.phase}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={simulatingId === m.id}
                        onClick={() => handleSimulateSandbox(m.id)}
                        className="h-6 text-[11px] px-2"
                      >
                        {simulatingId === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3 w-3" />
                        )}
                        Simular
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-5 py-3 bg-muted/20">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
