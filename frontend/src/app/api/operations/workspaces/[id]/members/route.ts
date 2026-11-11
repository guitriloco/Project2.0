import { NextRequest, NextResponse } from 'next/server'
const backend = process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001'
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const response = await fetch(`${backend}/api/workspaces/${id}/members`, { headers: { cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' }); return NextResponse.json(await response.json(), { status: response.status }) }
