'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, Lock, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ChainVerificationState {
  isValid: boolean
  brokenAtBlockIndex?: number
  totalBlocks: number
  latestHash: string
  verifiedAt: string
}

export function ChainIntegrityBanner() {
  const [data, setData] = useState<ChainVerificationState | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  async function checkChain() {
    setLoading(true)
    try {
      const res = await fetch('/api/operations/governance/verify-chain')
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastCheck(new Date())
      }
    } catch {
      // Ignore network errors in background polling
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkChain()
    const timer = setInterval(checkChain, 15000)
    return () => clearInterval(timer)
  }, [])

  if (!data) return null

  const isHealthy = data.isValid

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs transition-colors ${
        isHealthy
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-md ${
            isHealthy
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/20 text-destructive'
          }`}
        >
          {isHealthy ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-mono font-semibold">
            <span>
              {isHealthy
                ? `Cadeia Criptográfica: VERIFICADA (${data.totalBlocks} Blocos Selados)`
                : `ALERTA DE SEGURANÇA: Adulteração Detectada no Bloco #${data.brokenAtBlockIndex}`}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/20 text-destructive'
              }`}
            >
              {isHealthy ? 'ZERO TAMPER DETECTED' : 'CHAIN COMPROMISED'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-primary" />
              Topo da Cadeia: {data.latestHash ? `${data.latestHash.slice(0, 16)}...` : 'N/A'}
            </span>
            {lastCheck && (
              <>
                <span aria-hidden="true">·</span>
                <span>Auditado há {Math.round((Date.now() - lastCheck.getTime()) / 1000)}s</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={checkChain}
          disabled={loading}
          className="h-7 px-2.5 text-xs font-mono border-border bg-background/50 hover:bg-background"
        >
          <RefreshCw className={`mr-1.5 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Verificando...' : 'Recalcular Provas'}
        </Button>
      </div>
    </div>
  )
}
