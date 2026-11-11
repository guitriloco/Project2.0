import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const backendUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')

  try {
    const headers = new Headers()
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    const authorization = request.headers.get('authorization')
    if (authorization) headers.set('authorization', authorization)
    const response = await fetch(`${backendUrl}/api/operations/summary`, { headers, cache: 'no-store' })
    const payload = await response.json()
    return NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o estado operacional.' }, { status: 503 })
  }
}
