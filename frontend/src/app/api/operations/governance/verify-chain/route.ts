import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  try {
    const headers: Record<string, string> = {
      cookie: request.headers.get('cookie') ?? '',
    }
    const wsHeader = request.headers.get('x-workspace-id')
    if (wsHeader) headers['x-workspace-id'] = wsHeader

    const response = await fetch(`${baseUrl}/api/operations/governance/verify-chain`, {
      method: 'GET',
      headers,
    })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Falha ao verificar integridade da cadeia de governança.' }, { status: 503 })
  }
}
