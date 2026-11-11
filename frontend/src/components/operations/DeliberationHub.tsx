'use client'

import { useState } from 'react'
import {
  Vote,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Lock,
  ExternalLink,
  Ban,
  Activity,
  Layers,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OperationalEmptyState } from './OperationalEmptyState'
import type { Decision, DecisionSignature, DecisionProofData } from '@/lib/operations-contracts'

export interface DeliberationHubProps {
  decisions: Decision[]
  isLoading?: boolean
  isError?: boolean
  onDecisionCreate: (
    action: string,
    rationale: string,
    impact?: string,
    confidence?: number,
    threshold?: number
  ) => Promise<boolean>
  onVote?: (decisionId: string, support: boolean, rationale?: string) => Promise<boolean>
  onSign?: (decisionId: string, vote: 'APPROVE' | 'REJECT' | 'VETO', rationale?: string) => Promise<boolean>
  onRetry?: () => void
}

export function DeliberationHub({
  decisions,
  isLoading,
  isError,
  onDecisionCreate,
  onVote,
  onSign,
  onRetry,
}: DeliberationHubProps) {
  const [filter, setFilter] = useState<'all' | 'voting' | 'approved' | 'vetoed'>('all')
  const [actionInput, setActionInput] = useState('')
  const [rationaleInput, setRationaleInput] = useState('')
  const [impactInput, setImpactInput] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [confidenceInput, setConfidenceInput] = useState(0.85)
  const [thresholdInput, setThresholdInput] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signingId, setSigningId] = useState<string | null>(null)
  const [signRationale, setSignRationale] = useState<Record<string, string>>({})
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [activeProofData, setActiveProofData] = useState<Record<string, DecisionProofData | null>>({})
  const [loadingProofId, setLoadingProofId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!actionInput.trim() || !rationaleInput.trim() || isSubmitting) return

    setIsSubmitting(true)
    const success = await onDecisionCreate(
      actionInput.trim(),
      rationaleInput.trim(),
      impactInput,
      confidenceInput,
      thresholdInput
    )
    setIsSubmitting(false)

    if (success) {
      setActionInput('')
      setRationaleInput('')
      setThresholdInput(5)
    }
  }

  async function handleSignDecision(decisionId: string, vote: 'APPROVE' | 'REJECT' | 'VETO') {
    if (signingId) return
    setSigningId(decisionId)
    const rationale = signRationale[decisionId] || undefined

    try {
      if (onSign) {
        await onSign(decisionId, vote, rationale)
      } else if (onVote && vote !== 'VETO') {
        await onVote(decisionId, vote === 'APPROVE', rationale)
      } else {
        // Direct API invocation if custom handler not passed
        await fetch(`/api/operations/decisions/${decisionId}/sign`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ vote, rationale }),
        })
      }
    } finally {
      setSigningId(null)
      setSignRationale((prev) => ({ ...prev, [decisionId]: '' }))
    }
  }

  async function handleLoadProof(decisionId: string) {
    if (loadingProofId) return
    setLoadingProofId(decisionId)

    try {
      const res = await fetch(`/api/operations/decisions/${decisionId}/proof`)
      if (res.ok) {
        const data: DecisionProofData = await res.json()
        setActiveProofData((prev) => ({ ...prev, [decisionId]: data }))
        // Also expand drawer
        setExpandedDetails((prev) => ({ ...prev, [decisionId]: true }))
      }
    } catch {
      // Ignore network errors in proof loader
    } finally {
      setLoadingProofId(null)
    }
  }

  function toggleExpand(id: string) {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredDecisions = decisions.filter((d) => {
    const meta = (d.metadata as any) || {}
    const isVetoed = d.status === 'REJECTED' || meta.vetoStatus === 'VETOED'
    const isApproved = d.status === 'APPROVED'

    if (filter === 'vetoed') return isVetoed
    if (filter === 'approved') return isApproved
    if (filter === 'voting') return !isVetoed && !isApproved
    return true
  })

  return (
    <Card className="flex flex-col border border-border bg-card">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold tracking-tight">
              Deliberações Multi-Assinatura & Prova Criptográfica
            </CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Quórum dinâmico ponderado por RBAC, poder de veto soberano e hash chaining SHA-256 imutável.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todas ({decisions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('voting')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === 'voting'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Em Quórum
          </button>
          <button
            type="button"
            onClick={() => setFilter('approved')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === 'approved'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Ratificadas
          </button>
          <button
            type="button"
            onClick={() => setFilter('vetoed')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === 'vetoed'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vetadas
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 pt-2">
        {/* Deliberation Proposal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Propor Nova Deliberação Operacional</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Limiar Mínimo: {thresholdInput} pts
            </span>
          </div>

          <Input
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="Ação estratégica proposta (ex: Migrar pool de conexões Neon...)"
            disabled={isSubmitting}
            className="h-8 text-xs bg-background"
          />
          <Textarea
            value={rationaleInput}
            onChange={(e) => setRationaleInput(e.target.value)}
            placeholder="Fundamentação técnica, impacto operacional e análise de trade-offs..."
            disabled={isSubmitting}
            rows={2}
            className="text-xs resize-none bg-background"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">Impacto:</span>
              <div className="flex gap-1">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setImpactInput(lvl)}
                    className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                      impactInput === lvl
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <span className="text-muted-foreground">Quórum (Peso):</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                {[3, 5, 8].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setThresholdInput(pts)}
                    className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                      thresholdInput === pts
                        ? 'bg-primary/20 text-primary font-bold border border-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {pts}p
                  </button>
                ))}
              </div>

              <span className="text-muted-foreground">Confiança:</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {Math.round(confidenceInput * 100)}%
              </span>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !actionInput.trim() || !rationaleInput.trim()}
              size="sm"
              className="h-8 text-xs font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Publicar Proposta
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Deliberations List */}
        {isLoading && decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs font-mono">Carregando deliberações e quórum...</span>
          </div>
        ) : isError ? (
          <OperationalEmptyState
            title="Falha ao carregar deliberações"
            description="Não foi possível sincronizar o repositório de decisões operacionais."
            actionLabel="Recarregar"
            onAction={onRetry}
          />
        ) : filteredDecisions.length === 0 ? (
          <OperationalEmptyState
            title="Nenhuma deliberação neste filtro"
            description="Proponha a primeira deliberação técnica ou ajuste o filtro acima."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredDecisions.map((decision) => {
              const meta = (decision.metadata as any) || {}
              const isVetoed = decision.status === 'REJECTED' || meta.vetoStatus === 'VETOED'
              const isRatified = decision.status === 'APPROVED'
              const threshold = meta.requiredWeightThreshold ?? 5
              const currentWeight = meta.currentWeight ?? 0
              const weightRatio = Math.min(100, Math.round((currentWeight / threshold) * 100))
              const signatures: DecisionSignature[] = Array.isArray(meta.signatures) ? meta.signatures : []
              const proofHash = meta.cryptographicProofHash || null
              const isExpanded = !!expandedDetails[decision.id]
              const isSigning = signingId === decision.id
              const proofData = activeProofData[decision.id]
              const isLoadingProof = loadingProofId === decision.id

              return (
                <div
                  key={decision.id}
                  className={`flex flex-col gap-3 rounded-lg border p-4 transition-all ${
                    isVetoed
                      ? 'border-destructive/40 bg-destructive/5'
                      : isRatified
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-border bg-card/70 hover:border-border/90'
                  }`}
                >
                  {/* Top Bar: Impact, Status, and Cryptographic Hash Seal */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-foreground font-semibold">
                          {decision.impactLevel || decision.impact || 'MEDIUM'} IMPACT
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {decision.createdAt
                            ? new Date(decision.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Hoje'}
                        </span>
                        <span aria-hidden="true">·</span>
                        {isVetoed ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-destructive">
                            <Ban className="h-3 w-3" />
                            VETADO
                          </span>
                        ) : isRatified ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            RATIFICADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Activity className="h-3 w-3" />
                            EM DELIBERAÇÃO
                          </span>
                        )}
                        {proofHash && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5 text-primary" />
                              hash: {proofHash.slice(0, 10)}...
                            </span>
                          </>
                        )}
                      </div>

                      <h4 className="mt-1 text-sm font-semibold text-foreground">
                        {decision.action || decision.title}
                      </h4>
                    </div>

                    {/* Multi-Sig Quorum Badge */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="text-muted-foreground">Peso Quórum:</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isRatified
                              ? 'text-emerald-500'
                              : isVetoed
                              ? 'text-destructive'
                              : 'text-primary'
                          }`}
                        >
                          {currentWeight} / {threshold} pts
                        </span>
                      </div>
                      <div className="h-2 w-28 rounded-full bg-muted/80 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isVetoed
                              ? 'bg-destructive'
                              : isRatified
                              ? 'bg-emerald-500'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${isVetoed ? 100 : weightRatio}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rationale / Technical Context */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {decision.rationale || decision.context || 'Sem fundamentação descrita.'}
                  </p>

                  {/* Veto Alert Notice if applicable */}
                  {isVetoed && meta.vetoRationale && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      <span className="font-semibold">Justificativa de Veto Soberano:</span> {meta.vetoRationale}
                    </div>
                  )}

                  {/* Multi-Signature Signers List */}
                  {signatures.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-md bg-muted/30 p-2 text-xs">
                      <div className="text-[11px] font-mono text-muted-foreground font-medium">
                        Assinaturas Criptográficas Registradas ({signatures.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {signatures.map((sig, idx) => {
                          const isApprove = sig.vote === 'APPROVE'
                          const isVeto = sig.vote === 'VETO'
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] ${
                                isVeto
                                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                  : isApprove
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border-border bg-muted text-muted-foreground'
                              }`}
                              title={`Sig: ${sig.cryptographicSignature || 'N/A'}`}
                            >
                              <KeyRound className="h-2.5 w-2.5" />
                              <span className="font-semibold">{sig.userRole}</span>
                              <span>(+{sig.weight}p)</span>
                              <span className="uppercase">[{sig.vote}]</span>
                              {sig.cryptographicSignature && (
                                <span className="opacity-60">{sig.cryptographicSignature.slice(0, 6)}...</span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Signature Actions Bar */}
                  {!isRatified && !isVetoed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2.5 text-xs">
                      <Input
                        placeholder="Fundamentação da sua assinatura (opcional)..."
                        value={signRationale[decision.id] || ''}
                        onChange={(e) =>
                          setSignRationale((prev) => ({ ...prev, [decision.id]: e.target.value }))
                        }
                        disabled={isSigning}
                        className="h-7 text-xs flex-1 min-w-[160px] bg-background"
                      />
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSignDecision(decision.id, 'APPROVE')}
                          disabled={isSigning}
                          className="h-7 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          {isSigning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ThumbsUp className="mr-1 h-3 w-3" />
                          )}
                          Assinar (+Peso)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSignDecision(decision.id, 'REJECT')}
                          disabled={isSigning}
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:bg-muted"
                        >
                          <ThumbsDown className="mr-1 h-3 w-3" />
                          Rejeitar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSignDecision(decision.id, 'VETO')}
                          disabled={isSigning}
                          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                          title="Apenas papel OWNER tem autoridade para vetar"
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          Veto Soberano
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Footer & Proof Drawer Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(decision.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        <span>{isExpanded ? 'Ocultar Detalhes' : 'Metadados & Auditoria'}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLoadProof(decision.id)}
                        disabled={isLoadingProof}
                        className="h-6 px-2 text-[11px] font-mono text-primary hover:bg-primary/10"
                      >
                        {isLoadingProof ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-1 h-3 w-3 text-emerald-500" />
                        )}
                        Verificar Prova Criptográfica
                      </Button>
                    </div>

                    <span className="font-mono text-[11px] text-muted-foreground">
                      ID: {decision.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Collapsible Metadata & Cryptographic Proof HUD Drawer */}
                  {isExpanded && (
                    <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/50 p-3 font-mono text-[11px]">
                      {proofData && (
                        <div className="flex flex-col gap-2 pb-2 border-b border-border/60">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-foreground">
                              {proofData.chainVerification.isValid ? (
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                              )}
                              Status da Cadeia: {proofData.chainVerification.isValid ? 'INTEGRIDADE MATEMÁTICA CONFIRMADA' : 'ADULTERAÇÃO DETECTADA'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {proofData.chainVerification.totalBlocks} blocos selados
                            </span>
                          </div>

                          {proofData.proof && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] bg-background/60 p-2 rounded border border-border/40">
                              <div>
                                <span className="text-muted-foreground">Bloco Índice:</span> #{proofData.proof.blockIndex}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Ação Selada:</span> {proofData.proof.action}
                              </div>
                              <div className="truncate" title={proofData.proof.prevBlockHash}>
                                <span className="text-muted-foreground">Prev Hash:</span> {proofData.proof.prevBlockHash.slice(0, 16)}...
                              </div>
                              <div className="truncate" title={proofData.proof.currentBlockHash}>
                                <span className="text-muted-foreground">Current Hash:</span> {proofData.proof.currentBlockHash.slice(0, 16)}...
                              </div>
                              <div className="md:col-span-2 truncate" title={proofData.proof.signatureProof}>
                                <span className="text-muted-foreground">Assinatura HMAC:</span> {proofData.proof.signatureProof}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground overflow-x-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            {
                              id: decision.id,
                              action: decision.action,
                              status: decision.status,
                              requiredThreshold: threshold,
                              currentWeight,
                              signaturesCount: signatures.length,
                              cryptographicProofHash: proofHash,
                              metadata: decision.metadata,
                            },
                            null,
                            2
                          )}
                        </pre>
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
