import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  try {
    const headers: Record<string, string> = {
      cookie: request.headers.get('cookie') ?? '',
    }
    const wsHeader = request.headers.get('x-workspace-id')
    if (wsHeader) headers['x-workspace-id'] = wsHeader

    const response = await fetch(`${baseUrl}/api/decisions`, {
      method: 'GET',
      headers,
    })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar as decisões.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const baseUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  try {
    const headers: Record<string, string> = {
      cookie: request.headers.get('cookie') ?? '',
      'content-type': 'application/json',
    }
    const wsHeader = request.headers.get('x-workspace-id')
    if (wsHeader) headers['x-workspace-id'] = wsHeader

    const response = await fetch(`${baseUrl}/api/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await request.json()),
    })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Não foi possível registrar a decisão.' }, { status: 503 })
  }
}
