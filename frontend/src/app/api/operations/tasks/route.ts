import { NextRequest, NextResponse } from 'next/server'

const backendUrl = () => (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  const baseUrl = backendUrl()
  if (!baseUrl) return NextResponse.json({ error: 'Backend não configurado.' }, { status: 503 })
  try {
    const response = await fetch(`${baseUrl}/api/tasks`, { method: 'POST', headers: { cookie: request.headers.get('cookie') ?? '', 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar a tarefa.' }, { status: 503 })
  }
}

export async function PATCH(request: NextRequest) {
  const baseUrl = backendUrl()
  const id = request.nextUrl.searchParams.get('id')
  if (!baseUrl || !id) return NextResponse.json({ error: 'Backend ou tarefa não configurado.' }, { status: 400 })
  try {
    const response = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { cookie: request.headers.get('cookie') ?? '', 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível atualizar a tarefa.' }, { status: 503 })
  }
}
