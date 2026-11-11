import { NextRequest, NextResponse } from 'next/server'

const backendUrl = () => (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')

async function forward(request: NextRequest) {
  try {
    const response = await fetch(`${backendUrl()}${request.nextUrl.pathname.replace('/api/auth', '/api/auth')}${request.nextUrl.search}`, {
      method: request.method,
      headers: { cookie: request.headers.get('cookie') ?? '', origin: request.headers.get('origin') ?? request.nextUrl.origin, 'content-type': request.headers.get('content-type') ?? 'application/json' },
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
      cache: 'no-store',
    })
    const headers = new Headers(response.headers)
    return new NextResponse(await response.text(), { status: response.status, headers })
  } catch {
    return NextResponse.json({ error: 'Serviço de autenticação indisponível.' }, { status: 503 })
  }
}

export const GET = forward
export const POST = forward
export const OPTIONS = forward
