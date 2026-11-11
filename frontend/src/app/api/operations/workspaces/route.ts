import { NextRequest, NextResponse } from 'next/server'

const backend = process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001'

export async function GET(request: NextRequest) {
  const response = await fetch(`${backend}/api/workspaces`, { headers: { cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' })
  return NextResponse.json(await response.json(), { status: response.status })
}

export async function POST(request: NextRequest) {
  const response = await fetch(`${backend}/api/workspaces`, { method: 'POST', headers: { cookie: request.headers.get('cookie') ?? '', 'content-type': 'application/json' }, body: await request.text() })
  return NextResponse.json(await response.json(), { status: response.status })
}
