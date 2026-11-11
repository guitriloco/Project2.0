import { NextRequest, NextResponse } from 'next/server'
const backend = process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const response = await fetch(`${backend}/api/workspaces/${id}/invitations`, { method: 'POST', headers: { cookie: request.headers.get('cookie') ?? '', 'content-type': 'application/json' }, body: await request.text() }); return NextResponse.json(await response.json(), { status: response.status }) }
