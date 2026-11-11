import Link from 'next/link'
import { OperationalCenter } from '@/components/operational-center'

export default function ProductivityPage() {
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-10 lg:px-8"><div><nav className="flex flex-wrap gap-4 text-sm"><Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link><Link href="/workspaces" className="text-muted-foreground hover:text-foreground">Workspaces</Link><Link href="/executive" className="text-muted-foreground hover:text-foreground">Executivo</Link><Link href="/governance" className="text-muted-foreground hover:text-foreground">Governança</Link></nav><h1 className="mt-4 text-3xl font-semibold tracking-tight">Produtividade</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Planeje, execute e acompanhe o trabalho do workspace em um único fluxo.</p></div><OperationalCenter /></main>
}
