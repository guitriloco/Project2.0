import Link from 'next/link'
import { WorkspaceManager } from '@/components/workspace-manager'

export default function WorkspacesPage() {
  return <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 py-10"><div><nav className="flex flex-wrap gap-4 text-sm"><Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link><Link href="/executive" className="text-muted-foreground hover:text-foreground">Executivo</Link><Link href="/governance" className="text-muted-foreground hover:text-foreground">Governança</Link><Link href="/productivity" className="text-muted-foreground hover:text-foreground">Produtividade</Link></nav><h1 className="mt-4 text-3xl font-semibold tracking-tight">Workspace Manager</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Organize seus espaços de trabalho e mantenha a operação separada por contexto.</p></div><WorkspaceManager /></main>
}
