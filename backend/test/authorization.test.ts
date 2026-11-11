import { describe, it, expect } from 'vitest'

function canAccessWorkspace(member: { userId: string; workspaceId: string }, userId: string, workspaceId: string) {
  return member.userId === userId && member.workspaceId === workspaceId
}

describe('Workspace Authorization Logic', () => {
  it('permite acesso somente ao workspace do usuário', () => {
    const member = { userId: 'user-a', workspaceId: 'workspace-a' }
    expect(canAccessWorkspace(member, 'user-a', 'workspace-a')).toBe(true)
    expect(canAccessWorkspace(member, 'user-b', 'workspace-a')).toBe(false)
    expect(canAccessWorkspace(member, 'user-a', 'workspace-b')).toBe(false)
  })

  it('nega acesso quando não existe associação', () => {
    const member = { userId: 'user-a', workspaceId: 'workspace-a' }
    expect(canAccessWorkspace(member, 'user-a', 'workspace-missing')).toBe(false)
  })
})
