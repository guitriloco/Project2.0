import Link from 'next/link'
import { GovernanceCenter } from '@/components/governance-center'
import { ChainIntegrityBanner } from '@/components/operations/ChainIntegrityBanner'
import { CircuitBreakerPanel } from '@/components/operations/CircuitBreakerPanel'

export default function GovernancePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-5 py-10 lg:px-8">
      <div>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/workspaces" className="text-muted-foreground hover:text-foreground">
            Workspaces
          </Link>
          <Link href="/executive" className="text-muted-foreground hover:text-foreground">
            Executivo
          </Link>
          <Link href="/productivity" className="text-muted-foreground hover:text-foreground">
            Produtividade
          </Link>
        </nav>
        <div className="mt-4 flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Centro de Governança & Multi-Assinatura</h1>
          <p className="text-sm text-muted-foreground">
            Deliberações formais, quórum ponderado por RBAC, prova de integridade criptográfica SHA-256 e disjuntores de emergência.
          </p>
        </div>
      </div>

      <ChainIntegrityBanner />

      <CircuitBreakerPanel />

      <GovernanceCenter />
    </main>
  )
}
