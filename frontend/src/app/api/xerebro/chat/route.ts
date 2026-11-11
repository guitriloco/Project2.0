import { NextResponse } from 'next/server'

function getBackendUrl() {
  return (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch(`${getBackendUrl()}/api/xerebro/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const payload = await response.json()
    return NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao Xerebro Core.' },
      { status: 503 },
    )
  }
}
