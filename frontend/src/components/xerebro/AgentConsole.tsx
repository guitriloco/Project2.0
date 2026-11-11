'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Terminal,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface ExecutionProposal {
  id: string
  tool: string
  category: string
  parameters: Record<string, any>
  rationale: string
  workspaceId: string
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
  createdAt: string
  executedAt?: string
  result?: any
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface AgentConsoleProps {
  workspaceName?: string
  onActionExecuted?: () => void
}

export function AgentConsole({ workspaceName = 'Workspace Operacional', onActionExecuted }: AgentConsoleProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        'Saudações. Sou o Xerebro, o Orquestrador Autônomo do Core. Estou conectado à telemetria e pronto para inspecionar métricas, propor tarefas ou formular deliberações com validação humana (HITL). Como posso coordenar as operações agora?',
      createdAt: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [proposals, setProposals] = useState<ExecutionProposal[]>([])
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch active proposals for active workspace
  async function fetchProposals() {
    try {
      const res = await fetch('/api/xerebro/proposals')
      if (res.ok) {
        const data = await res.json()
        setProposals(data)
      }
    } catch {
      // offline / quiet
    }
  }

  useEffect(() => {
    fetchProposals()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, proposals])

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || input).trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/xerebro/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) {
        const problem = await res.json().catch(() => null)
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content:
              problem?.detail ||
              'Não foi possível processar o comando no momento. Verifique as permissões de acesso.',
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.text || 'Operação processada.',
          createdAt: new Date().toISOString(),
        },
      ])

      if (Array.isArray(data.proposals)) {
        setProposals(data.proposals)
      } else {
        await fetchProposals()
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Falha de rede ao se comunicar com o orquestrador autônomo.',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleExecuteProposal(proposalId: string) {
    setActionProcessingId(proposalId)
    try {
      const res = await fetch(`/api/xerebro/proposals/${encodeURIComponent(proposalId)}/execute`, {
        method: 'POST',
      })

      if (res.ok) {
        await fetchProposals()
        onActionExecuted?.()
      }
    } finally {
      setActionProcessingId(null)
    }
  }

  async function handleRejectProposal(proposalId: string) {
    setActionProcessingId(proposalId)
    try {
      const res = await fetch(`/api/xerebro/proposals/${encodeURIComponent(proposalId)}/reject`, {
        method: 'POST',
      })

      if (res.ok) {
        await fetchProposals()
      }
    } finally {
      setActionProcessingId(null)
    }
  }

  const pendingProposals = proposals.filter((p) => p.status === 'PENDING_APPROVAL')

  return (
    <Card className="flex flex-col border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">
                Xerebro Copiloto Operacional (HITL)
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">· RAG Ativo</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Agente determinístico com portão de autorização humana para mutações críticas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>{workspaceName}</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-1">
        {/* Pending HITL Proposals Banner */}
        {pendingProposals.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {pendingProposals.length} {pendingProposals.length === 1 ? 'Ação requer' : 'Ações requerem'} aprovação humana
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">HITL Gatekeeper</span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {pendingProposals.map((prop) => (
                <div
                  key={prop.id}
                  className="flex flex-col gap-2 rounded-md border border-border/80 bg-background/90 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {prop.tool === 'proposeOperationalTask'
                        ? 'Criação de Tarefa'
                        : 'Registro de Deliberação'}
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {new Date(prop.createdAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>

                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Ação:</span>{' '}
                    {prop.parameters.title || prop.parameters.action}
                  </div>

                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Fundamentação:</span>{' '}
                    {prop.rationale}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actionProcessingId === prop.id}
                      onClick={() => handleRejectProposal(prop.id)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={actionProcessingId === prop.id}
                      onClick={() => handleExecuteProposal(prop.id)}
                      className="h-7 text-xs font-medium"
                    >
                      {actionProcessingId === prop.id ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Aprovar Execução
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex h-72 flex-col gap-3 overflow-y-auto rounded-lg border border-border/80 bg-muted/20 p-3">
          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                  <span>{isUser ? 'Você' : 'Xerebro Agent'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {new Date(m.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <div
                  className={`rounded-lg px-3.5 py-2 text-xs leading-relaxed max-w-[85%] ${
                    isUser
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'border border-border bg-card text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            )
          })}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Xerebro está deliberando com ferramentas do Core...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Sparkles className="h-3 w-3 text-primary" />
            Sugestões:
          </span>
          <button
            type="button"
            onClick={() => handleSendMessage('Qual o resumo consolidado do workspace agora?')}
            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Resumo do workspace
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Proponha uma tarefa para otimizar os índices do Postgres.')}
            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Propor tarefa técnica
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Consulte os últimos eventos de auditoria.')}
            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Consultar auditoria
          </button>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2 pt-1"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instrua o agente (ex: Propor tarefa de segurança, consultar telemetria...)"
            disabled={isLoading}
            className="h-9 text-xs bg-background"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="sm"
            className="h-9 px-4 text-xs font-medium shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Enviar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
