import { NextRequest, NextResponse } from 'next/server'
const backend = process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001'
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) { const { id, memberId } = await params; const response = await fetch(`${backend}/api/workspaces/${id}/members/${memberId}`, { method: 'PATCH', headers: { cookie: request.headers.get('cookie') ?? '', 'content-type': 'application/json' }, body: await request.text() }); return NextResponse.json(await response.json(), { status: response.status }) }
