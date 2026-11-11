import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  try {
    const query = request.nextUrl.search
    const response = await fetch(`${baseUrl}/api/audit${query}`, { cache: 'no-store' })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar a auditoria.' }, { status: 503 })
  }
}
