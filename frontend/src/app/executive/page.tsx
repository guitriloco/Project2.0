import Link from 'next/link'
import { ExecutivePanel } from '@/components/executive-panel'

export default function ExecutivePage() {
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-10 lg:px-8"><div><nav className="flex flex-wrap gap-4 text-sm"><Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link><Link href="/workspaces" className="text-muted-foreground hover:text-foreground">Workspaces</Link><Link href="/governance" className="text-muted-foreground hover:text-foreground">Governança</Link><Link href="/productivity" className="text-muted-foreground hover:text-foreground">Produtividade</Link></nav><h1 className="mt-4 text-3xl font-semibold tracking-tight">Painel Executivo</h1></div><ExecutivePanel /></main>
}
