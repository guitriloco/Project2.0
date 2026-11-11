'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  ShieldAlert,
  Power,
  RotateCcw,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCheck,
  Hash,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  CircuitBreaker,
  CircuitBreakerSubsystem,
  PolicyExecutionReceipt,
} from '@/lib/operations-contracts';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao obter dados.');
  return res.json();
};

export function CircuitBreakerPanel() {
  const {
    data: breakers,
    error: breakersError,
    isLoading,
    mutate: mutateBreakers,
  } = useSWR<CircuitBreaker[]>('/api/operations/policies/circuit-breakers', fetcher, {
    refreshInterval: 5000,
  });

  const {
    data: executions,
    mutate: mutateExecutions,
  } = useSWR<PolicyExecutionReceipt[]>('/api/operations/policies/executions', fetcher, {
    refreshInterval: 8000,
  });

  // Modal & Form states
  const [selectedBreaker, setSelectedBreaker] = useState<CircuitBreaker | null>(null);
  const [modalMode, setModalMode] = useState<'TRIP' | 'RESET' | null>(null);
  const [tripReason, setTripReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [testingPolicy, setTestingPolicy] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleTripConfirm = async () => {
    if (!selectedBreaker) return;
    if (!tripReason.trim() || tripReason.length < 3) {
      showFeedback('error', 'É obrigatório fornecer uma justificativa para o desarme de emergência.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/operations/policies/circuit-breakers/${selectedBreaker.id}/trip`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: tripReason.trim() }),
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Falha ao desarmar disjuntor.');
      }

      showFeedback('success', `Disjuntor [${selectedBreaker.name}] foi DESARMADO em quarentena.`);
      setModalMode(null);
      setSelectedBreaker(null);
      setTripReason('');
      await mutateBreakers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao processar desarme.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetConfirm = async () => {
    if (!selectedBreaker) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/operations/policies/circuit-breakers/${selectedBreaker.id}/reset`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Falha ao rearmar disjuntor.');
      }

      showFeedback('success', `Disjuntor [${selectedBreaker.name}] foi REARMADO para operação nominal.`);
      setModalMode(null);
      setSelectedBreaker(null);
      await mutateBreakers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao processar rearme.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestPolicyExecution = async () => {
    setTestingPolicy(true);
    try {
      const res = await fetch('/api/operations/policies/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decisionId: `test-dec-${Date.now().toString().slice(-6)}`,
          action: 'DEPLOY_SOVEREIGN_CONTRACT_PATCH',
          impact: 'CRITICAL',
          rationale: 'Teste de disparo autônomo pós-ratificação sob supervisão.',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Falha no teste de política.');
      }

      showFeedback('success', 'Ciclo de política executado com sucesso e encadeado na auditoria SHA-256.');
      await Promise.all([mutateExecutions(), mutateBreakers()]);
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro na execução.');
    } finally {
      setTestingPolicy(false);
    }
  };

  const activeQuarantineCount = breakers?.filter((b) => b.state === 'OPEN').length || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Emergency Indicator */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold ${
              activeQuarantineCount > 0
                ? 'border-destructive/60 bg-destructive/15 text-destructive animate-pulse'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
            }`}
          >
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Disjuntores Soberanos & Kill-Switches
              </h2>
              {activeQuarantineCount > 0 ? (
                <span className="rounded bg-destructive/20 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
                  {activeQuarantineCount} em Quarentena
                </span>
              ) : (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Operação Nominal
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Proteção de integridade operacional, interrupção imediata de subsistemas em crise e
              execuções de políticas criptograficamente seladas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestPolicyExecution}
            disabled={testingPolicy}
            className="font-mono text-xs"
          >
            <Play className={`mr-1.5 size-3.5 ${testingPolicy ? 'animate-spin' : ''}`} />
            {testingPolicy ? 'Executando...' : 'Testar Política'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              mutateBreakers();
              mutateExecutions();
            }}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1 size-3.5" />
            Sincronizar
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-medium ${
            feedback.type === 'error'
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid of Circuit Breakers */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && !breakers && (
          <div className="col-span-2 py-8 text-center font-mono text-xs text-muted-foreground">
            Consultando registradores de barramento soberano...
          </div>
        )}

        {breakers?.map((breaker) => {
          const isOpen = breaker.state === 'OPEN';
          return (
            <Card
              key={breaker.id}
              className={`relative overflow-hidden transition-all duration-200 ${
                isOpen
                  ? 'border-destructive/80 bg-destructive/[0.03] shadow-md ring-1 ring-destructive/40'
                  : 'border-border/60 hover:border-border'
              }`}
            >
              {isOpen && (
                <div className="absolute top-0 right-0 left-0 h-1 bg-destructive animate-pulse" />
              )}
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold tracking-tight">
                      {breaker.name}
                    </CardTitle>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        isOpen
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <Power className="size-3" />
                      {isOpen ? 'TRIPPED / ABERTO' : 'CLOSED / SEGURO'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{breaker.id}</span>
                </div>

                {isOpen ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    onClick={() => {
                      setSelectedBreaker(breaker);
                      setModalMode('RESET');
                    }}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" />
                    Rearmar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-xs"
                    onClick={() => {
                      setSelectedBreaker(breaker);
                      setModalMode('TRIP');
                    }}
                  >
                    <Power className="mr-1.5 size-3.5" />
                    Desarmar
                  </Button>
                )}
              </CardHeader>

              <CardContent className="flex flex-col gap-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">{breaker.description}</p>

                {isOpen && breaker.tripReason && (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-2.5 font-mono text-[11px] text-destructive">
                    <span className="font-bold">Motivo do desarme:</span> {breaker.tripReason}
                    <div className="mt-1 text-[10px] opacity-80">
                      Disparado em: {new Date(breaker.trippedAt || '').toLocaleString('pt-BR')}
                    </div>
                  </div>
                )}

                <div className="mt-1 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 font-mono text-[11px] text-muted-foreground">
                  <div>
                    <span>Acionamentos: </span>
                    <strong className="text-foreground">{breaker.tripCount}</strong>
                  </div>
                  <div>
                    <span>Limite auto-trip: </span>
                    <strong className="text-foreground">
                      {breaker.autoTripConfig.consecutiveFailuresThreshold} falhas /{' '}
                      {breaker.autoTripConfig.windowSeconds}s
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Policy Executions Feed / Audit Receipts */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="size-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Execuções Automatizadas de Políticas
            </h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {executions?.length || 0} execuções registradas
          </span>
        </div>

        {(!executions || executions.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
            Nenhuma execução automática disparada ainda. Clique em &quot;Testar Política&quot; para validar.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/40">
            {executions.slice(0, 5).map((rec) => (
              <div key={rec.id} className="flex flex-col gap-1 py-3 text-xs first:pt-1 last:pb-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{rec.policyName}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      rec.status === 'EXECUTED'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : rec.status === 'BLOCKED_BY_CIRCUIT_BREAKER'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-destructive/20 text-destructive'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {rec.durationMs}ms
                  </span>
                  <span>Disparo: {rec.triggerEntityType} ({rec.triggerEntityId.slice(0, 10)})</span>
                  {rec.cryptographicProofHash && (
                    <span className="flex items-center gap-1 text-primary">
                      <Hash className="size-3" />
                      SHA: {rec.cryptographicProofHash.slice(0, 12)}...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Trip / Reset */}
      {modalMode && selectedBreaker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {modalMode === 'TRIP'
                ? `Acionar Kill-Switch: ${selectedBreaker.name}`
                : `Rearmar Disjuntor: ${selectedBreaker.name}`}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {modalMode === 'TRIP'
                ? 'O acionamento deste disjuntor interromperá imediatamente as operações do subsistema correspondente e será gravado de forma imutável na cadeia SHA-256 de auditoria.'
                : 'A restauração do estado nominal reativará o tráfego e as rotinas automáticas do subsistema com assinatura do operador.'}
            </p>

            {modalMode === 'TRIP' && (
              <div className="mt-4 flex flex-col gap-1.5">
                <label className="font-mono text-[11px] font-semibold text-foreground">
                  Justificativa Operacional do Desarme *
                </label>
                <textarea
                  value={tripReason}
                  onChange={(e) => setTripReason(e.target.value)}
                  placeholder="Descreva o motivo do bloqueio de emergência (ex: anomalia de rede, investigação de falhas)..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModalMode(null);
                  setSelectedBreaker(null);
                  setTripReason('');
                }}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              {modalMode === 'TRIP' ? (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleTripConfirm}
                  disabled={actionLoading || !tripReason.trim()}
                >
                  {actionLoading ? 'Processando...' : 'Confirmar Desarme de Emergência'}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResetConfirm}
                  disabled={actionLoading}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {actionLoading ? 'Processando...' : 'Confirmar Rearme'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
