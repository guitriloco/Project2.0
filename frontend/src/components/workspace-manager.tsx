'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Workspace = { id: string; name: string; role: string; createdAt: string }

const previewWorkspace: Workspace = { id: 'preview-workspace', name: 'Preview Workspace', role: 'OWNER', createdAt: new Date().toISOString() }

export function WorkspaceManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([previewWorkspace])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [members, setMembers] = useState<{ id: string; role: string; user: { email: string; name?: string | null } }[]>([])

  async function load() {
    const response = await fetch('/api/operations/workspaces', { cache: 'no-store' })
    if (response.ok) setWorkspaces(await response.json())
  }
  useEffect(() => { void load() }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const response = await fetch(editing ? `/api/operations/workspaces/${editing}` : '/api/operations/workspaces', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    if (!response.ok) {
      if (!editing) setWorkspaces((current) => [...current, { id: `preview-${Date.now()}`, name, role: 'OWNER', createdAt: new Date().toISOString() }])
      else setWorkspaces((current) => current.map((workspace) => workspace.id === editing ? { ...workspace, name } : workspace))
      setName(''); setEditing(null); return
    }
    setName(''); setEditing(null); await load()
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const workspace = workspaces[0]
    if (!workspace) return
    const response = await fetch(`/api/operations/workspaces/${workspace.id}/invitations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) })
    if (!response.ok) { setError('Não foi possível criar o convite.'); return }
    setInviteEmail('')
  }

  async function loadMembers(id: string) {
    const response = await fetch(`/api/operations/workspaces/${id}/members`, { cache: 'no-store' })
    if (response.ok) setMembers(await response.json())
  }

  return <Card className="border-border/70 bg-card/70">
    <CardHeader><CardTitle className="text-lg">Workspaces</CardTitle></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">{workspaces.map((workspace) => <div key={workspace.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3"><div><p className="font-medium">{workspace.name}</p><p className="text-xs uppercase tracking-wider text-muted-foreground">{workspace.role}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditing(workspace.id); setName(workspace.name) }}>Editar</Button><Button variant="outline" size="sm" onClick={() => void loadMembers(workspace.id)}>Membros</Button></div></div>)}</div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do novo workspace" aria-label="Nome do workspace" required /><Button type="submit">{editing ? 'Salvar nome' : 'Criar workspace'}</Button></form>
      {members.length > 0 && <div className="flex flex-col gap-2"><p className="text-sm font-medium">Membros</p>{members.map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"><span>{member.user.name || member.user.email}</span><span className="text-xs uppercase tracking-wider text-muted-foreground">{member.role}</span></div>)}</div>}
      {workspaces.some((workspace) => workspace.role === 'OWNER' || workspace.role === 'ADMIN') && <form onSubmit={invite} className="flex flex-col gap-3 border-t border-border/60 pt-4"><p className="text-sm font-medium">Convidar membro</p><div className="flex flex-col gap-3 sm:flex-row"><Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="email@empresa.com" aria-label="Email do convidado" type="email" required /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="rounded-md border border-input bg-background px-3 text-sm"><option value="MEMBER">Membro</option><option value="ADMIN">Administrador</option></select><Button type="submit">Criar convite</Button></div></form>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>
}
